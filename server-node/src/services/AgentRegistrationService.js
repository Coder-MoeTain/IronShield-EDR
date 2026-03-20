/**
 * Agent registration service
 */
const crypto = require('crypto');
const db = require('../utils/db');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Register a new endpoint agent
 * @param {Object} payload - Registration payload from agent
 * @param {string} registrationToken - Bootstrap token
 * @returns {Object} - { agentKey, endpointId }
 */
async function register(payload, registrationToken) {
  if (registrationToken !== config.agent.registrationToken) {
    throw new Error('Invalid registration token');
  }

  const {
    hostname,
    os_version,
    logged_in_user,
    ip_address,
    mac_address,
    agent_version,
  } = payload;

  if (!hostname || typeof hostname !== 'string') {
    throw new Error('Hostname is required');
  }

  const agentKey = crypto.randomBytes(32).toString('hex');
  const defaultTenantId = 1;

  let result;
  try {
    result = await db.execute(
      `INSERT INTO endpoints (agent_key, tenant_id, hostname, os_version, logged_in_user, ip_address, mac_address, agent_version, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online')`,
      [
        agentKey,
        defaultTenantId,
        String(hostname).substring(0, 255),
        os_version ? String(os_version).substring(0, 128) : null,
        logged_in_user ? String(logged_in_user).substring(0, 255) : null,
        ip_address ? String(ip_address).substring(0, 45) : null,
        mac_address ? String(mac_address).substring(0, 64) : null,
        agent_version ? String(agent_version).substring(0, 32) : null,
      ]
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' && err.message?.includes('tenant_id')) {
      result = await db.execute(
        `INSERT INTO endpoints (agent_key, hostname, os_version, logged_in_user, ip_address, mac_address, agent_version, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'online')`,
        [
          agentKey,
          String(hostname).substring(0, 255),
          os_version ? String(os_version).substring(0, 128) : null,
          logged_in_user ? String(logged_in_user).substring(0, 255) : null,
          ip_address ? String(ip_address).substring(0, 45) : null,
          mac_address ? String(mac_address).substring(0, 64) : null,
          agent_version ? String(agent_version).substring(0, 32) : null,
        ]
      );
    } else {
      throw err;
    }
  }

  const endpointId = result.insertId;
  logger.info({ endpointId, hostname }, 'Agent registered');

  return { agentKey, endpointId };
}

module.exports = { register };
