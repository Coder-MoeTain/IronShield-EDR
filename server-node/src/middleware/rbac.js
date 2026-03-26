/**
 * RBAC middleware - permission checks for admin routes
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

const LEGACY_ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: ['actions:write', 'alerts:write', 'rules:write', 'audit:read', 'xdr:read', 'xdr:write', 'manage_integrations'],
  analyst: ['actions:write', 'alerts:write', 'rules:write', 'audit:read', 'xdr:read'],
  viewer: [],
};

async function getUserPermissions(userId, role, tenantId = null) {
  if (!userId) return [];
  if (role === 'super_admin') return ['*'];

  // If tenantId is set, use tenant-bound roles first; otherwise fall back to global roles (tenant_id IS NULL).
  // Note: schema uses (user_id, role_id) as PK; tenant_id may be null. We treat null tenant as "global role".
  try {
    const rows = await db.query(
      `
        SELECT DISTINCT p.name AS permission
        FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = ?
          AND (ur.tenant_id <=> ? OR ur.tenant_id IS NULL)
      `,
      [userId, tenantId]
    );
    const perms = rows.map((r) => r.permission).filter(Boolean);
    if (perms.length > 0) return perms;
  } catch (err) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(String(err?.code || ''))) throw err;
    logger.warn({ userId, role, tenantId, err: err.message }, 'RBAC tables missing; using legacy role fallback');
  }

  return LEGACY_ROLE_PERMISSIONS[String(role || '').toLowerCase()] || [];
}

function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const perms = await getUserPermissions(req.user.userId, req.user.role, req.tenantId ?? req.user.tenantId ?? null);
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
    const perms = await getUserPermissions(req.user.userId, req.user.role, req.tenantId ?? req.user.tenantId ?? null);
    if (perms.includes('*')) return next();
    if (permissions.some((p) => perms.includes(p))) return next();
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { requirePermission, requireAnyPermission, getUserPermissions };
