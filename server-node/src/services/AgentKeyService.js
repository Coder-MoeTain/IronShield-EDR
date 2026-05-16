/**
 * Agent key lifecycle: rotate/revoke/expire
 */
const db = require('../utils/db');
const { generateRawKey, hashAgentKey } = require('../utils/agentKeyHash');

async function rotate(endpointId) {
  const endpoint = await db.queryOne(
    'SELECT id, agent_key_hash FROM endpoints WHERE id = ? LIMIT 1',
    [endpointId]
  );
  if (!endpoint) throw new Error('Endpoint not found');
  const prevKeyHash = endpoint.agent_key_hash || null;
  const agentKey = generateRawKey();
  const agentKeyHash = hashAgentKey(agentKey);
  try {
    await db.execute(
      `UPDATE endpoints
       SET agent_key_hash = ?, agent_key = NULL,
           prev_agent_key_hash = ?,
           agent_key_created_at = NOW(),
           agent_key_rotated_at = NOW(),
           agent_key_revoked_at = NULL
       WHERE id = ?`,
      [agentKeyHash, prevKeyHash, endpointId]
    );
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    await db.execute(
      `UPDATE endpoints
       SET agent_key = ?, prev_agent_key_hash = ?,
           agent_key_created_at = NOW(), agent_key_rotated_at = NOW(), agent_key_revoked_at = NULL
       WHERE id = ?`,
      [agentKey, prevKeyHash, endpointId]
    );
  }
  return { agentKey };
}

async function revokeByEndpointId(endpointId) {
  const r = await db.execute(
    'UPDATE endpoints SET agent_key_revoked_at = NOW() WHERE id = ? AND agent_key_revoked_at IS NULL',
    [endpointId]
  );
  return r.affectedRows > 0;
}

module.exports = { rotate, revokeByEndpointId };

