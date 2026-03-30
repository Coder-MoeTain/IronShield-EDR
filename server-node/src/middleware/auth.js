/**
 * Authentication middleware
 */
const config = require('../config');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const { verifyWithRotation } = require('../utils/jwtVerify');
const crypto = require('crypto');

const signedAgentRequestNonceCache = new Map();

function timingSafeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ''), 'hex');
  const bb = Buffer.from(String(b || ''), 'hex');
  if (aa.length === 0 || bb.length === 0 || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac('sha256', String(secret)).update(payload, 'utf8').digest('hex');
}

function pruneExpiredNonces(nowMs) {
  for (const [key, expiresAt] of signedAgentRequestNonceCache.entries()) {
    if (expiresAt <= nowMs) signedAgentRequestNonceCache.delete(key);
  }
}

function verifySignedAgentRequest(req, agentKey, endpointId) {
  const ts = req.headers['x-agent-timestamp'];
  const nonce = req.headers['x-agent-nonce'];
  const signature = req.headers['x-agent-signature'];
  const bodySha = req.headers['x-agent-body-sha256'];
  const required = config.agent?.requestSigningRequired === true;

  if (!ts || !nonce || !signature || !bodySha) {
    if (!required) return { ok: true, mode: 'legacy' };
    return { ok: false, reason: 'missing' };
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'bad_timestamp' };

  const maxSkew = Number(config.agent?.requestSigningMaxSkewSeconds || 300);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > maxSkew) return { ok: false, reason: 'clock_skew' };

  const rawBody = req.rawBody ?? '';
  const computedBodySha = sha256Hex(rawBody);
  if (!timingSafeEqualHex(String(bodySha), computedBodySha)) {
    return { ok: false, reason: 'body_hash_mismatch' };
  }

  const payload = `${req.method}\n${req.originalUrl}\n${tsNum}\n${nonce}\n${computedBodySha}`;
  const expectedSig = hmacSha256Hex(agentKey, payload);
  if (!timingSafeEqualHex(String(signature), expectedSig)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const nowMs = Date.now();
  pruneExpiredNonces(nowMs);
  const replayKey = `${endpointId}:${tsNum}:${nonce}`;
  if (signedAgentRequestNonceCache.has(replayKey)) {
    return { ok: false, reason: 'replay' };
  }
  signedAgentRequestNonceCache.set(replayKey, nowMs + (maxSkew * 1000));
  return { ok: true, mode: 'signed' };
}

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
    const signatureCheck = verifySignedAgentRequest(req, req.agentKey, req.endpointId);
    if (!signatureCheck.ok) {
      metrics.agentAuthFailuresTotal.inc({ reason: signatureCheck.reason });
      return res.status(401).json({ error: 'Invalid agent request signature', reason: signatureCheck.reason });
    }
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
