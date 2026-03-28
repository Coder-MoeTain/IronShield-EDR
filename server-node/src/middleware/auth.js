/**
 * Authentication middleware
 */
const config = require('../config');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { verifyWithRotation } = require('../utils/jwtVerify');

/**
 * Verify JWT for admin routes
 */
async function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyWithRotation(token);
    const db = require('../utils/db');
    const row = await db.queryOne(
      'SELECT is_active, session_version FROM admin_users WHERE id = ? LIMIT 1',
      [decoded.userId]
    );
    if (!row || !row.is_active) {
      return res.status(401).json({ error: 'Account inactive' });
    }
    const tokenSv = Number(decoded.sv || 1);
    const currentSv = Number(row.session_version || 1);
    if (tokenSv !== currentSv) {
      return res.status(401).json({ error: 'Session revoked' });
    }
    req.user = { ...decoded, tenantId: decoded.tenantId ?? null };
    return next();
  } catch (err) {
    // Expired tokens are normal (browser still has localStorage); avoid WARN spam per request.
    if (err.name === 'TokenExpiredError') {
      logger.debug({ err: err.message }, 'JWT expired');
    } else {
      logger.warn({ err: err.message, name: err.name }, 'Invalid JWT');
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Verify agent key for agent API routes
 */
function authAgent(req, res, next) {
  const agentKey = req.headers['x-agent-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!agentKey) {
    return res.status(401).json({ error: 'Agent key required' });
  }

  req.agentKey = agentKey;
  next();
}

/**
 * Verify agent key by DB lookup and attach endpoint context.
 * Sets: req.agentKey, req.endpointId, req.tenantId
 */
async function authAgentValidated(req, res, next) {
  // Optional enterprise control: require mTLS for agent endpoints (TLS layer validates CA).
  if (config.tls?.agentMtlsRequired) {
    const ok = req.client?.authorized === true;
    if (!ok) {
      metrics.agentAuthFailuresTotal.inc({ reason: 'mtls' });
      return res.status(401).json({ error: 'mTLS required' });
    }
  }

  const agentKey = req.headers['x-agent-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!agentKey) {
    metrics.agentAuthFailuresTotal.inc({ reason: 'missing' });
    return res.status(401).json({ error: 'Agent key required' });
  }

  try {
    const db = require('../utils/db');
    const row = await db.queryOne(
      'SELECT id, tenant_id, status, agent_key_expires_at, agent_key_revoked_at FROM endpoints WHERE agent_key = ? LIMIT 1',
      [String(agentKey)]
    );
    if (!row) {
      metrics.agentAuthFailuresTotal.inc({ reason: 'unknown' });
      return res.status(401).json({ error: 'Unknown agent key' });
    }
    if (row.agent_key_revoked_at) {
      metrics.agentAuthFailuresTotal.inc({ reason: 'revoked' });
      return res.status(401).json({ error: 'Agent key revoked' });
    }
    if (row.agent_key_expires_at && new Date(row.agent_key_expires_at).getTime() < Date.now()) {
      metrics.agentAuthFailuresTotal.inc({ reason: 'expired' });
      return res.status(401).json({ error: 'Agent key expired' });
    }

    req.agentKey = String(agentKey);
    req.endpointId = row.id;
    req.tenantId = row.tenant_id ?? null;
    return next();
  } catch (err) {
    logger.error({ err: err.message }, 'Agent auth lookup failed');
    return res.status(503).json({ error: 'Auth unavailable' });
  }
}

/**
 * Optional auth - attach user if token present
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      req.user = verifyWithRotation(token);
    } catch (_) {
      req.user = null;
    }
  }
  next();
}

module.exports = { authAdmin, authAgent, authAgentValidated, optionalAuth };
