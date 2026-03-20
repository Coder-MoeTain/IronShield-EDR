/**
 * Response action service - create and manage response actions
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

async function create(endpointId, actionType, parameters, requestedBy) {
  const result = await db.execute(
    `INSERT INTO response_actions (endpoint_id, action_type, parameters, requested_by, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [endpointId, actionType, parameters ? JSON.stringify(parameters) : null, requestedBy]
  );

  if (actionType === 'simulate_isolation') {
    await db.query(
      "UPDATE endpoints SET policy_status = 'isolated', status = 'isolated' WHERE id = ?",
      [endpointId]
    );
  }
  if (actionType === 'mark_investigating') {
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
     WHERE endpoint_id = ? AND status IN ('pending', 'sent')
     ORDER BY created_at ASC`,
    [endpoint.id]
  );

  return actions;
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

async function fail(id, message) {
  await db.query(
    `UPDATE response_actions SET status = 'failed', result_message = ?, completed_at = NOW() WHERE id = ?`,
    [message, id]
  );
}

async function listForEndpoint(endpointId) {
  return db.query(
    `SELECT * FROM response_actions WHERE endpoint_id = ? ORDER BY created_at DESC`,
    [endpointId]
  );
}

module.exports = {
  create,
  getPendingForAgent,
  markSent,
  complete,
  fail,
  listForEndpoint,
};
