/**
 * RBAC middleware - permission checks for admin routes
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  analyst: [
    'endpoints:read', 'endpoints:write', 'alerts:read', 'alerts:write',
    'events:read', 'rules:read', 'rules:write', 'incidents:read', 'incidents:write',
    'iocs:read', 'iocs:write', 'risk:read', 'policies:read', 'policies:write',
    'investigations:read', 'investigations:write', 'triage:read', 'triage:write',
    'actions:write', 'audit:read', 'notifications:read',
    'manage_integrations', 'manage_tenants',
  ],
  viewer: [
    'endpoints:read', 'alerts:read', 'events:read', 'rules:read',
    'incidents:read', 'iocs:read', 'risk:read', 'policies:read',
    'investigations:read', 'triage:read', 'audit:read', 'notifications:read',
  ],
};

async function getUserPermissions(userId, role) {
  if (role === 'super_admin') return ['*'];
  return ROLE_PERMISSIONS[role] || [];
}

function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const perms = await getUserPermissions(req.user.userId, req.user.role);
    if (perms.includes('*') || perms.includes(permission)) {
      return next();
    }
    logger.warn({ userId: req.user.userId, permission }, 'Permission denied');
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const perms = await getUserPermissions(req.user.userId, req.user.role);
    if (perms.includes('*')) return next();
    if (permissions.some((p) => perms.includes(p))) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { requirePermission, requireAnyPermission, getUserPermissions };
