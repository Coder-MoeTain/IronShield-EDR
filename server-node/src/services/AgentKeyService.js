/**
 * Agent key lifecycle: rotate/revoke/expire
 */
const crypto = require('crypto');
const db = require('../utils/db');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function newKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function rotate(endpointId) {
  const endpoint = await db.queryOne(
    'SELECT id, agent_key FROM endpoints WHERE id = ? LIMIT 1',
    [endpointId]
  );
  if (!endpoint) throw new Error('Endpoint not found');
  const prevKeyHash = endpoint.agent_key ? sha256Hex(endpoint.agent_key) : null;
  const agentKey = newKey();
  await db.execute(
    `UPDATE endpoints
     SET agent_key = ?,
         prev_agent_key_hash = ?,
         agent_key_created_at = NOW(),
         agent_key_rotated_at = NOW(),
         agent_key_revoked_at = NULL
     WHERE id = ?`,
    [agentKey, prevKeyHash, endpointId]
  );
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

