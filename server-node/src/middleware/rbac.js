/**
 * RBAC middleware - permission checks for admin routes
 */
const db = require('../utils/db');
const logger = require('../utils/logger');
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');
const {
  ROLE_PERMISSION_DEFAULTS,
  hasAnyPermission,
} = require('../constants/permissions');

const LEGACY_ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: ['actions:write', 'alerts:write', 'rules:write', 'audit:read', 'xdr:read', 'xdr:write', 'manage_integrations'],
  analyst: ['actions:write', 'alerts:write', 'rules:write', 'audit:read', 'xdr:read'],
  viewer: [],
};

async function getUserPermissions(userId, role, tenantId = null) {
  if (!userId) return [];
  if (role === 'super_admin') return ['*'];

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

  const roleKey = String(role || '').toLowerCase();
  const enterpriseDefaults = ROLE_PERMISSION_DEFAULTS[roleKey];
  const legacy = LEGACY_ROLE_PERMISSIONS[roleKey] || [];
  if (enterpriseDefaults?.length) {
    return [...new Set([...enterpriseDefaults, ...legacy])];
  }

  return legacy;
}

function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return sendErrorFromReq(
        res,
        req,
        ERROR_CODES.AUTHENTICATION_REQUIRED,
        'Authentication required',
        401
      );
    }
    const perms = await getUserPermissions(req.user.userId, req.user.role, req.tenantId ?? req.user.tenantId ?? null);
    if (hasAnyPermission(perms, [permission])) {
      return next();
    }
    logger.warn({ userId: req.user.userId, permission }, 'Permission denied');
    return sendErrorFromReq(res, req, ERROR_CODES.PERMISSION_DENIED, 'Insufficient permissions', 403);
  };
}

function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return sendErrorFromReq(
        res,
        req,
        ERROR_CODES.AUTHENTICATION_REQUIRED,
        'Authentication required',
        401
      );
    }
    const perms = await getUserPermissions(req.user.userId, req.user.role, req.tenantId ?? req.user.tenantId ?? null);
    if (hasAnyPermission(perms, permissions)) {
      return next();
    }
    return sendErrorFromReq(res, req, ERROR_CODES.PERMISSION_DENIED, 'Insufficient permissions', 403);
  };
}

module.exports = { requirePermission, requireAnyPermission, getUserPermissions };
