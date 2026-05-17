/**
 * Software remediation actions and user notifications.
 */
const db = require('../../utils/db');
const AuditLogService = require('../../services/AuditLogService');
const SoftwareInventoryService = require('./softwareInventoryService');

const HIGH_RISK_BLOCK_PATTERNS = [
  { test: (p) => !p.vendor && !p.software_name, reason: 'vendor-wide block' },
  { test: (p) => (p.executable_path_pattern || '').includes('*') && (p.executable_path_pattern || '').length < 20, reason: 'wildcard path' },
  { test: (p) => /chrome|firefox|edge|safari/i.test(p.software_name || ''), reason: 'blocking browser' },
  { test: (p) => /defender|crowdstrike|sentinel|mcafee|symantec|kaspersky|eset/i.test(p.software_name || ''), reason: 'blocking security tool' },
];

function requiresBlockApproval(policy) {
  return HIGH_RISK_BLOCK_PATTERNS.some((h) => h.test(policy));
}

async function createAction({
  tenantId,
  endpointId,
  softwareInventoryId,
  actionType,
  messageTitle,
  messageBody,
  requestedBy,
  approvedBy,
  requiresApproval,
  expiresAt,
}) {
  const result = await db.execute(
    `INSERT INTO software_remediation_actions (
      tenant_id, endpoint_id, software_inventory_id, action_type, status,
      message_title, message_body, requested_by, approved_by, requires_approval, expires_at
    ) VALUES (?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      endpointId,
      softwareInventoryId,
      actionType,
      messageTitle,
      messageBody,
      requestedBy,
      approvedBy || null,
      requiresApproval ? 1 : 0,
      expiresAt || null,
    ]
  );
  const id = result?.insertId;
  await AuditLogService.log({
    username: requestedBy,
    action: `software.remediation_${actionType}`,
    resourceType: 'software_remediation',
    resourceId: String(id),
    details: { endpoint_id: endpointId, software_inventory_id: softwareInventoryId },
  });
  return { id, status: 'requested' };
}

async function notifyUpdate(inventoryId, tenantId, actor, body = {}) {
  const sw = await SoftwareInventoryService.getById(inventoryId, tenantId);
  if (!sw) return null;
  const factors = sw.risk_factors || {};
  const title = body.title || `Security Update Required: ${sw.name}`;
  const message =
    body.message ||
    `Your device has ${sw.name} version ${sw.version || 'unknown'}, which has a security risk score of ${sw.risk_score || 0}/100. ` +
      `Recommended action: Update to version ${factors.fixed_version || 'latest'} or later.`;
  const action = await createAction({
    tenantId,
    endpointId: sw.endpoint_id,
    softwareInventoryId: inventoryId,
    actionType: 'notify_update',
    messageTitle: title,
    messageBody: message,
    requestedBy: actor,
  });
  await db.query(
    `INSERT INTO software_user_notifications (
      tenant_id, endpoint_id, software_inventory_id, remediation_action_id,
      title, message, severity, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'warning', 'pending')`,
    [tenantId, sw.endpoint_id, inventoryId, action.id, title, message]
  );
  await db.query(
    `UPDATE software_remediation_actions SET status = 'pending_agent' WHERE id = ?`,
    [action.id]
  );
  return action;
}

async function notifyUninstall(inventoryId, tenantId, actor, body = {}) {
  const sw = await SoftwareInventoryService.getById(inventoryId, tenantId);
  if (!sw) return null;
  const title = body.title || `Uninstall Required: ${sw.name}`;
  const message =
    body.message ||
    `Please uninstall ${sw.name} version ${sw.version || 'unknown'} from your device. Contact IT/SOC if you need assistance.`;
  const action = await createAction({
    tenantId,
    endpointId: sw.endpoint_id,
    softwareInventoryId: inventoryId,
    actionType: 'notify_uninstall',
    messageTitle: title,
    messageBody: message,
    requestedBy: actor,
  });
  await db.query(
    `INSERT INTO software_user_notifications (
      tenant_id, endpoint_id, software_inventory_id, remediation_action_id,
      title, message, severity, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'critical', 'pending')`,
    [tenantId, sw.endpoint_id, inventoryId, action.id, title, message]
  );
  await db.query(`UPDATE software_remediation_actions SET status = 'pending_agent' WHERE id = ?`, [
    action.id,
  ]);
  return action;
}

async function hasPendingRefresh(endpointId, tenantId) {
  const rows = await db.query(
    `SELECT 1 FROM software_remediation_actions
     WHERE endpoint_id = ? AND tenant_id = ? AND action_type = 'refresh_inventory'
       AND status IN ('requested','pending_agent') LIMIT 1`,
    [endpointId, tenantId]
  );
  return (rows || []).length > 0;
}

async function acceptRisk(inventoryId, tenantId, actor, { until, reason } = {}) {
  if (!reason || String(reason).trim().length < 3) {
    const err = new Error('Accept risk reason is required');
    err.code = 'REASON_REQUIRED';
    throw err;
  }
  const sw = await SoftwareInventoryService.getById(inventoryId, tenantId);
  if (!sw) return null;
  await db.query(
    `UPDATE endpoint_software_risk SET accepted_risk = 1, accepted_risk_until = ? WHERE software_inventory_id = ?`,
    [until || null, inventoryId]
  );
  const action = await createAction({
    tenantId,
    endpointId: sw.endpoint_id,
    softwareInventoryId: inventoryId,
    actionType: 'accept_risk',
    messageTitle: 'Risk accepted',
    messageBody: reason || 'Accepted by SOC',
    requestedBy: actor,
  });
  await db.query(`UPDATE software_remediation_actions SET status = 'completed' WHERE id = ?`, [
    action.id,
  ]);
  await AuditLogService.log({
    username: actor,
    action: 'software.accept_risk',
    resourceType: 'software_inventory',
    resourceId: String(inventoryId),
    details: { until, reason },
  });
  return action;
}

async function requestRefresh(inventoryId, tenantId, actor) {
  const sw = await SoftwareInventoryService.getById(inventoryId, tenantId);
  if (!sw) return null;
  return createAction({
    tenantId,
    endpointId: sw.endpoint_id,
    softwareInventoryId: inventoryId,
    actionType: 'refresh_inventory',
    messageTitle: 'Refresh inventory',
    messageBody: 'Requested by admin',
    requestedBy: actor,
  });
}

async function listActions(tenantId, filters = {}) {
  const { endpointId, status, limit = 50, offset = 0 } = filters;
  const where = ['sra.tenant_id = ?'];
  const params = [tenantId];
  if (endpointId) {
    where.push('sra.endpoint_id = ?');
    params.push(endpointId);
  }
  if (status) {
    where.push('sra.status = ?');
    params.push(status);
  }
  const rows = await db.query(
    `SELECT sra.*, esi.name AS software_name, esi.version, e.hostname
     FROM software_remediation_actions sra
     JOIN endpoint_software_inventory esi ON esi.id = sra.software_inventory_id
     JOIN endpoints e ON e.id = sra.endpoint_id
     WHERE ${where.join(' AND ')}
     ORDER BY sra.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return { rows: rows || [] };
}

async function recordNotificationResult({
  tenantId,
  endpointId,
  notificationId,
  userResponse,
  status,
}) {
  await db.query(
    `UPDATE software_user_notifications SET
      user_response = ?, status = ?, acknowledged_at = NOW(), shown_at = COALESCE(shown_at, NOW())
     WHERE id = ? AND tenant_id = ? AND endpoint_id = ?`,
    [userResponse, status || 'acknowledged', notificationId, tenantId, endpointId]
  );
  const [rows] = await db.query(
    'SELECT remediation_action_id FROM software_user_notifications WHERE id = ?',
    [notificationId]
  );
  const remId = rows?.[0]?.remediation_action_id;
  if (remId) {
    await db.query(`UPDATE software_remediation_actions SET status = 'acknowledged', result = ? WHERE id = ?`, [
      JSON.stringify({ user_response: userResponse }),
      remId,
    ]);
  }
  return { ok: true };
}

async function getPendingNotifications(endpointId, tenantId) {
  return db.query(
    `SELECT * FROM software_user_notifications
     WHERE endpoint_id = ? AND tenant_id = ? AND status IN ('pending','sent')
     ORDER BY created_at ASC LIMIT 20`,
    [endpointId, tenantId]
  );
}

module.exports = {
  createAction,
  notifyUpdate,
  notifyUninstall,
  acceptRisk,
  requestRefresh,
  listActions,
  recordNotificationResult,
  getPendingNotifications,
  hasPendingRefresh,
  requiresBlockApproval,
};
