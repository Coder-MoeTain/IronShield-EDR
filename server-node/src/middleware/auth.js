/**
 * Authentication middleware
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Verify JWT for admin routes
 */
function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = { ...decoded, tenantId: decoded.tenantId ?? null };
    next();
  } catch (err) {
    logger.warn({ err: err.message }, 'Invalid JWT');
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
 * Optional auth - attach user if token present
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      req.user = jwt.verify(token, config.jwt.secret);
    } catch (_) {
      req.user = null;
    }
  }
  next();
}

module.exports = { authAdmin, authAgent, optionalAuth };
