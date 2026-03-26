/**
 * Agent registration service
 */
const crypto = require('crypto');
const db = require('../utils/db');
const config = require('../config');
const logger = require('../utils/logger');
const TenantService = require('./TenantService');
const EnrollmentTokenService = require('./EnrollmentTokenService');

/**
 * Register a new endpoint agent
 * @param {Object} payload - Registration payload from agent
 * @param {string} registrationToken - Bootstrap token
 * @returns {Object} - { agentKey, endpointId }
 */
async function register(payload, registrationToken) {
  // Enterprise: prefer per-tenant enrollment tokens (DB). Platform bootstrap token is optional break-glass.
  let enrollment = null;
  if (registrationToken) {
    enrollment = await EnrollmentTokenService.resolveToken(registrationToken);
  }
  const platformOk = registrationToken && registrationToken === config.agent.registrationToken;
  if (!enrollment && !platformOk) throw new Error('Invalid registration token');

  const {
    hostname,
    os_version,
    logged_in_user,
    ip_address,
    mac_address,
    agent_version,
    tenant_slug,
  } = payload;

  if (!hostname || typeof hostname !== 'string') {
    throw new Error('Hostname is required');
  }

  let resolvedTenantId = TenantService.DEFAULT_TENANT_ID;
  try {
    resolvedTenantId = await TenantService.getDefaultTenant();
  } catch (e) {
    logger.warn({ err: e.message }, 'getDefaultTenant failed; using default id');
  }

  // If enrollment token is tenant-bound, it wins.
  if (enrollment?.tenantId) {
    resolvedTenantId = enrollment.tenantId;
  } else if (tenant_slug != null && String(tenant_slug).trim() !== '') {
    const tid = await TenantService.getTenantIdBySlug(tenant_slug);
    if (!tid) {
      throw new Error('Unknown tenant slug');
    }
    resolvedTenantId = tid;
  }

  const agentKey = crypto.randomBytes(32).toString('hex');
  const defaultTenantId = resolvedTenantId;

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
