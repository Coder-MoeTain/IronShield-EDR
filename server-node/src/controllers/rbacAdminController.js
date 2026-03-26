/**
 * RBAC admin controller
 */
const RbacAdminService = require('../services/RbacAdminService');
const AuditLogService = require('../services/AuditLogService');

async function listRoles(req, res, next) {
  try {
    res.json(await RbacAdminService.listRoles());
  } catch (e) {
    next(e);
  }
}

async function listPermissions(req, res, next) {
  try {
    res.json(await RbacAdminService.listPermissions());
  } catch (e) {
    next(e);
  }
}

async function listUsers(req, res, next) {
  try {
    res.json(await RbacAdminService.listAdminUsers(req.tenantId));
  } catch (e) {
    next(e);
  }
}

async function getUserRoles(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    res.json(await RbacAdminService.getUserRoles(userId));
  } catch (e) {
    next(e);
  }
}

async function setUserRoles(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const { tenant_id, role_names } = req.body || {};
    const tenantId = tenant_id === undefined || tenant_id === null || tenant_id === '' ? null : parseInt(tenant_id, 10);
    await RbacAdminService.setUserRoles({ userId, tenantId, roleNames: role_names || [] });
    await AuditLogService.log({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'rbac_set_user_roles',
      resourceType: 'admin_user',
      resourceId: String(userId),
      details: { tenant_id: tenantId, role_names: role_names || [] },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message || '').includes('Unknown role')) return res.status(400).json({ error: e.message });
    next(e);
  }
}

module.exports = { listRoles, listPermissions, listUsers, getUserRoles, setUserRoles };

