/**
 * Response action service - create and manage response actions
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

const DANGEROUS_ACTIONS = new Set([
  'kill_process',
  'isolate_host',
  'lift_isolation',
  'quarantine_file',
  'block_ip',
  'run_script',
  'rtr_shell',
  'delete_schtask',
  'delete_run_key',
  'delete_path',
]);

function requiresApproval(actionType) {
  return DANGEROUS_ACTIONS.has(String(actionType || '').toLowerCase());
}

/** Ensure parameters is a plain object for JSON API (mysql2 may return JSON column as string). */
function normalizeActionRow(row) {
  if (!row || row.parameters == null) return row;
  let p = row.parameters;
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch {
      p = null;
    }
  }
  return { ...row, parameters: p };
}

async function create(endpointId, actionType, parameters, requestedBy, tenantId = null) {
  const normalizedType =
    actionType === 'simulate_isolation' ? 'isolate_host' : actionType;

  if (normalizedType === 'block_hash') {
    const IocMatchingService = require('./IocMatchingService');
    const sha = parameters?.sha256 || parameters?.hash;
    if (!sha || String(sha).trim().length < 32) {
      throw new Error('parameters.sha256 (64-char hex) required for block_hash');
    }
    await IocMatchingService.addHashIoc(
      String(sha).trim(),
      `block_hash action by ${requestedBy}`,
      tenantId
    );
    const result = await db.execute(
      `INSERT INTO response_actions (endpoint_id, action_type, parameters, requested_by, status, result_message, completed_at)
       VALUES (?, ?, ?, ?, 'completed', ?, NOW())`,
      [
        endpointId,
        normalizedType,
        parameters ? JSON.stringify(parameters) : null,
        requestedBy,
        'Hash added to IOC watchlist (server-side)',
      ]
    );
    logger.info({ endpointId, actionType: normalizedType }, 'block_hash IOC recorded');
    return result.insertId;
  }

  const approvalStatus = requiresApproval(normalizedType) ? 'pending' : 'auto';
  const result = await db.execute(
    `INSERT INTO response_actions (endpoint_id, action_type, parameters, requested_by, approval_status, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [endpointId, normalizedType, parameters ? JSON.stringify(parameters) : null, requestedBy, approvalStatus]
  );

  if (normalizedType === 'isolate_host') {
    await db.query(
      "UPDATE endpoints SET policy_status = 'isolated', status = 'isolated' WHERE id = ?",
      [endpointId]
    );
  }
  // lift_isolation: endpoint row updates only after agent reports success (see agentController)
  if (normalizedType === 'mark_investigating') {
    await db.query(
      "UPDATE endpoints SET status = 'investigating', policy_status = 'investigating' WHERE id = ?",
      [endpointId]
    );
  }

  logger.info({ endpointId, actionType, requestedBy }, 'Response action created');
  return result.insertId;
}

async function getPendingForAgent(agentKey) {
  const endpoint = await db.queryOne('SELECT id FROM endpoints WHERE agent_key = ?', [agentKey]);
  if (!endpoint) return [];

  const actions = await db.query(
    `SELECT * FROM response_actions
     WHERE endpoint_id = ?
       AND status IN ('pending', 'sent')
       AND approval_status IN ('auto', 'approved')
     ORDER BY created_at ASC`,
    [endpoint.id]
  );

  return actions;
}

async function listPendingApprovals(tenantId = null, limit = 200) {
  let sql = `
    SELECT ra.*, e.hostname, e.tenant_id
    FROM response_actions ra
    JOIN endpoints e ON e.id = ra.endpoint_id
    WHERE ra.approval_status = 'pending'
  `;
  const params = [];
  if (tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' ORDER BY ra.created_at DESC LIMIT ?';
  params.push(Math.min(limit || 200, 500));
  const rows = await db.query(sql, params);
  return rows.map(normalizeActionRow);
}

async function approve(id, approvedBy, { requireTwoPerson = true } = {}) {
  const row = await db.queryOne('SELECT id, requested_by, approval_status FROM response_actions WHERE id = ?', [id]);
  if (!row) throw new Error('Action not found');
  if (row.approval_status !== 'pending') throw new Error('Action is not pending approval');
  if (requireTwoPerson && String(row.requested_by || '') === String(approvedBy || '')) {
    throw new Error('Two-person rule: requester cannot approve own action');
  }
  await db.execute(
    `UPDATE response_actions
     SET approval_status = 'approved', approved_by = ?, approved_at = NOW()
     WHERE id = ?`,
    [String(approvedBy).substring(0, 128), id]
  );
}

async function reject(id, rejectedBy, reason = null) {
  const row = await db.queryOne('SELECT id, approval_status FROM response_actions WHERE id = ?', [id]);
  if (!row) throw new Error('Action not found');
  if (row.approval_status !== 'pending') throw new Error('Action is not pending approval');
  await db.execute(
    `UPDATE response_actions
     SET approval_status = 'rejected', rejected_by = ?, rejected_at = NOW(), rejection_reason = ?
     WHERE id = ?`,
    [String(rejectedBy).substring(0, 128), reason ? String(reason).substring(0, 512) : null, id]
  );
}

async function markSent(id) {
  await db.query(
    "UPDATE response_actions SET status = 'sent', sent_at = NOW() WHERE id = ?",
    [id]
  );
}

async function complete(id, resultMessage, resultJson) {
  await db.query(
    `UPDATE response_actions SET status = 'completed', result_message = ?, result_json = ?, completed_at = NOW() WHERE id = ?`,
    [resultMessage, resultJson ? JSON.stringify(resultJson) : null, id]
  );
}

/** Called when agent confirms lift_isolation succeeded — restores host policy in console. */
async function clearHostIsolationOnEndpoint(endpointId) {
  await db.query(
    `UPDATE endpoints SET policy_status = 'normal', status = CASE WHEN status = 'isolated' THEN 'online' ELSE status END WHERE id = ?`,
    [endpointId]
  );
}

async function fail(id, message) {
  await db.query(
    `UPDATE response_actions SET status = 'failed', result_message = ?, completed_at = NOW() WHERE id = ?`,
    [message, id]
  );
}

async function listForEndpoint(endpointId) {
  const rows = await db.query(
    `SELECT * FROM response_actions WHERE endpoint_id = ? ORDER BY created_at DESC`,
    [endpointId]
  );
  return rows.map(normalizeActionRow);
}

module.exports = {
  create,
  getPendingForAgent,
  listPendingApprovals,
  approve,
  reject,
  markSent,
  complete,
  fail,
  listForEndpoint,
  clearHostIsolationOnEndpoint,
};
