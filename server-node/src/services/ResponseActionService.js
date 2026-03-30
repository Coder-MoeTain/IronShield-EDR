/**
 * Response action service - create and manage response actions
 */
const db = require('../utils/db');
const logger = require('../utils/logger');
const {
  evaluateCreation,
  evaluateDecision,
} = require('./ResponseApprovalPolicyService');

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

async function create(endpointId, actionType, parameters, requestedBy, tenantId = null, opts = {}) {
  const creationPolicy = evaluateCreation({
    actionType,
    justification: opts.justification || parameters?.justification,
  });
  const normalizedType = creationPolicy.actionType;

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

  const approvalStatus = creationPolicy.approvalStatus;
  const mergedParameters = {
    ...(parameters && typeof parameters === 'object' ? parameters : {}),
    _approval_policy_version: creationPolicy.policyVersion,
    _request_justification: opts.justification || parameters?.justification || null,
    _requested_by_user_id: opts.requestedByUserId ?? null,
    _requested_by_role: opts.requestedByRole ?? null,
  };
  const result = await db.execute(
    `INSERT INTO response_actions (endpoint_id, action_type, parameters, requested_by, approval_status, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [endpointId, normalizedType, JSON.stringify(mergedParameters), requestedBy, approvalStatus]
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

async function getForApprovalDecision(id, tenantId = null) {
  let sql = `
    SELECT ra.id, ra.requested_by, ra.approval_status, ra.action_type, e.tenant_id
    FROM response_actions ra
    JOIN endpoints e ON e.id = ra.endpoint_id
    WHERE ra.id = ?
  `;
  const params = [id];
  if (tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  return db.queryOne(sql, params);
}

async function approve(id, actor, { requireTwoPerson = true, tenantId = null, reason = null } = {}) {
  const row = await getForApprovalDecision(id, tenantId);
  if (!row) throw new Error('Action not found');
  const decisionPolicy = evaluateDecision({
    action: row,
    actor,
    requireTwoPerson,
    reason,
  });

  await db.execute(
    `UPDATE response_actions
     SET approval_status = 'approved', approved_by = ?, approved_at = NOW()
     WHERE id = ?`,
    [String(actor?.username || '').substring(0, 128), id]
  );
  return {
    actionId: String(id),
    actionType: row.action_type,
    tenantId: row.tenant_id ?? null,
    policyVersion: decisionPolicy.policyVersion,
    decision: 'approved',
    reason: reason || null,
  };
}

async function reject(id, actor, reason = null, { tenantId = null } = {}) {
  const row = await getForApprovalDecision(id, tenantId);
  if (!row) throw new Error('Action not found');
  const decisionPolicy = evaluateDecision({
    action: row,
    actor,
    requireTwoPerson: false,
    reason,
  });
  await db.execute(
    `UPDATE response_actions
     SET approval_status = 'rejected', rejected_by = ?, rejected_at = NOW(), rejection_reason = ?
     WHERE id = ?`,
    [String(actor?.username || '').substring(0, 128), reason ? String(reason).substring(0, 512) : null, id]
  );
  return {
    actionId: String(id),
    actionType: row.action_type,
    tenantId: row.tenant_id ?? null,
    policyVersion: decisionPolicy.policyVersion,
    decision: 'rejected',
    reason: reason || null,
  };
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
