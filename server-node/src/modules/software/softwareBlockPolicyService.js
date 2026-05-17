/**
 * Software execution block policies (tenant-scoped, audited).
 */
const db = require('../../utils/db');
const AuditLogService = require('../../services/AuditLogService');
const { requiresBlockApproval } = require('./softwareRemediationService');

async function list(tenantId, filters = {}) {
  const { enabled, limit = 100, offset = 0 } = filters;
  const where = ['tenant_id = ?'];
  const params = [tenantId];
  if (enabled != null) {
    where.push('enabled = ?');
    params.push(enabled ? 1 : 0);
  }
  const rows = await db.query(
    `SELECT * FROM software_block_policies WHERE ${where.join(' AND ')}
     ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return rows || [];
}

async function getById(id, tenantId) {
  const rows = await db.query(
    'SELECT * FROM software_block_policies WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return rows?.[0] || null;
}

async function create(tenantId, data, actor) {
  const needsApproval = requiresBlockApproval(data);
  const result = await db.execute(
    `INSERT INTO software_block_policies (
      tenant_id, name, description, software_name, vendor, version_expression,
      executable_path_pattern, file_hash, action, user_message_title, user_message_body,
      enabled, expires_at, created_by, requires_approval
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      data.name,
      data.description || null,
      data.software_name,
      data.vendor || null,
      data.version_expression || null,
      data.executable_path_pattern || null,
      data.file_hash || null,
      data.action || 'block',
      data.user_message_title || 'Blocked by IT Security',
      data.user_message_body || data.message_body || 'This application is blocked by security policy.',
      data.enabled !== false ? 1 : 0,
      data.expires_at || null,
      actor,
      needsApproval ? 1 : 0,
    ]
  );
  const id = result?.insertId;
  await AuditLogService.log({
    username: actor,
    action: 'software.block_policy_created',
    resourceType: 'software_block_policy',
    resourceId: String(id),
    details: { name: data.name, requires_approval: needsApproval },
  });
  return { id, requires_approval: needsApproval };
}

async function update(id, tenantId, data, actor) {
  await db.query(
    `UPDATE software_block_policies SET
      name = COALESCE(?, name), description = COALESCE(?, description),
      software_name = COALESCE(?, software_name), vendor = COALESCE(?, vendor),
      version_expression = COALESCE(?, version_expression),
      executable_path_pattern = COALESCE(?, executable_path_pattern),
      file_hash = COALESCE(?, file_hash), action = COALESCE(?, action),
      user_message_title = COALESCE(?, user_message_title),
      user_message_body = COALESCE(?, user_message_body),
      enabled = COALESCE(?, enabled), expires_at = COALESCE(?, expires_at)
     WHERE id = ? AND tenant_id = ?`,
    [
      data.name,
      data.description,
      data.software_name,
      data.vendor,
      data.version_expression,
      data.executable_path_pattern,
      data.file_hash,
      data.action,
      data.user_message_title,
      data.user_message_body,
      data.enabled != null ? (data.enabled ? 1 : 0) : null,
      data.expires_at,
      id,
      tenantId,
    ]
  );
  await AuditLogService.log({
    username: actor,
    action: 'software.block_policy_updated',
    resourceType: 'software_block_policy',
    resourceId: String(id),
  });
}

async function approve(id, tenantId, approver, requester) {
  if (approver === requester) {
    const err = new Error('Cannot approve own high-risk block request');
    err.code = 'SOD_VIOLATION';
    throw err;
  }
  await db.query(
    'UPDATE software_block_policies SET approved_by = ?, requires_approval = 0 WHERE id = ? AND tenant_id = ?',
    [approver, id, tenantId]
  );
  await AuditLogService.log({
    username: approver,
    action: 'software.block_policy_approved',
    resourceType: 'software_block_policy',
    resourceId: String(id),
  });
}

async function remove(id, tenantId, actor) {
  await db.query('DELETE FROM software_block_policies WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  await AuditLogService.log({
    username: actor,
    action: 'software.block_policy_deleted',
    resourceType: 'software_block_policy',
    resourceId: String(id),
  });
}

async function blockInventoryItem(inventoryId, tenantId, actor, approver) {
  const inv = await db.query(
    'SELECT * FROM endpoint_software_inventory WHERE id = ? AND tenant_id = ?',
    [inventoryId, tenantId]
  );
  const sw = inv?.[0];
  if (!sw) return null;

  const policyData = {
    name: `Block ${sw.name}`,
    software_name: sw.name,
    vendor: sw.vendor,
    version_expression: sw.version ? `=${sw.version}` : null,
    executable_path_pattern: null,
    action: 'block',
  };
  const needsApproval = requiresBlockApproval(policyData);
  if (needsApproval && !approver) {
    const err = new Error('High-risk block requires approval');
    err.code = 'APPROVAL_REQUIRED';
    throw err;
  }

  const { id: policyId } = await create(tenantId, policyData, actor);
  if (needsApproval && approver) await approve(policyId, tenantId, approver, actor);

  await db.query(
    'UPDATE endpoint_software_risk SET blocked = 1, recommended_action = ? WHERE software_inventory_id = ?',
    ['block', inventoryId]
  );

  const SoftwareRemediationService = require('./softwareRemediationService');
  await SoftwareRemediationService.createAction({
    tenantId,
    endpointId: sw.endpoint_id,
    softwareInventoryId: inventoryId,
    actionType: 'block_execution',
    messageTitle: policyData.user_message_title || 'Software blocked',
    messageBody: 'Execution of this software is blocked by security policy.',
    requestedBy: actor,
    approvedBy: approver,
    requiresApproval: needsApproval,
  });

  return { policy_id: policyId, blocked: true };
}

async function unblockInventoryItem(inventoryId, tenantId, actor) {
  await db.query(
    'UPDATE endpoint_software_risk SET blocked = 0 WHERE software_inventory_id = ?',
    [inventoryId]
  );
  const SoftwareRemediationService = require('./softwareRemediationService');
  const inv = await db.query(
    'SELECT endpoint_id FROM endpoint_software_inventory WHERE id = ? AND tenant_id = ?',
    [inventoryId, tenantId]
  );
  if (inv?.[0]) {
    await SoftwareRemediationService.createAction({
      tenantId,
      endpointId: inv[0].endpoint_id,
      softwareInventoryId: inventoryId,
      actionType: 'unblock_execution',
      messageTitle: 'Software unblocked',
      messageBody: 'Block removed by admin',
      requestedBy: actor,
    });
  }
  await AuditLogService.log({
    username: actor,
    action: 'software.unblock',
    resourceType: 'software_inventory',
    resourceId: String(inventoryId),
  });
  return { blocked: false };
}

async function getAgentPolicies(tenantId) {
  const rows = await db.query(
    `SELECT id, name, software_name, vendor, version_expression, executable_path_pattern,
            file_hash, action, user_message_title, user_message_body, expires_at
     FROM software_block_policies
     WHERE tenant_id = ? AND enabled = 1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (requires_approval = 0 OR approved_by IS NOT NULL)`,
    [tenantId]
  );
  const [ver] = await db.query(
    'SELECT COALESCE(MAX(updated_at), NOW()) AS v FROM software_block_policies WHERE tenant_id = ?',
    [tenantId]
  );
  return {
    policy_version: Date.parse(ver?.v || ver?.[0]?.v || Date.now()),
    inventory_enabled: true,
    inventory_interval_hours: 24,
    block_policies: (rows || []).map((r) => ({
      id: String(r.id),
      name: r.name,
      software_name: r.software_name,
      vendor: r.vendor,
      version_expression: r.version_expression,
      executable_path_pattern: r.executable_path_pattern,
      file_hash: r.file_hash,
      action: r.action,
      message_title: r.user_message_title,
      message_body: r.user_message_body,
      expires_at: r.expires_at,
    })),
  };
}

module.exports = {
  list,
  getById,
  create,
  update,
  approve,
  remove,
  blockInventoryItem,
  unblockInventoryItem,
  getAgentPolicies,
};
