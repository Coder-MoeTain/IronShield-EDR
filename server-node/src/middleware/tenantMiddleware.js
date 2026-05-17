/**
 * Multi-tenant middleware - attaches tenant context to request
 * For super_admin: honors X-Tenant-Id header to scope to a specific tenant
 */
const TenantService = require('../services/TenantService');

async function attachTenant(req, res, next) {
  if (!req.user) return next();
  try {
    const overrideTenantId = req.headers['x-tenant-id'];
    const previousTenantId = req.tenantId;
    req.tenantId = await TenantService.getEffectiveTenantId(req.user, overrideTenantId);

    if (
      overrideTenantId &&
      req.user.role === 'super_admin' &&
      req.tenantId != null &&
      String(req.tenantId) !== String(previousTenantId ?? '')
    ) {
      const AuditLogService = require('../services/AuditLogService');
      AuditLogService.log({
        action: 'tenant_context_switch',
        resource_type: 'tenant',
        resource_id: String(req.tenantId),
        username: req.user.username,
        user_id: req.user.userId,
        tenant_id: req.tenantId,
        details: {
          header: 'X-Tenant-Id',
          requested_tenant_id: overrideTenantId,
          path: req.path,
        },
      }).catch(() => {});
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachTenant };
