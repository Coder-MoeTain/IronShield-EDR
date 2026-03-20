/**
 * Multi-tenant middleware - attaches tenant context to request
 * For super_admin: honors X-Tenant-Id header to scope to a specific tenant
 */
const TenantService = require('../services/TenantService');

async function attachTenant(req, res, next) {
  if (!req.user) return next();
  try {
    const overrideTenantId = req.headers['x-tenant-id'];
    req.tenantId = await TenantService.getEffectiveTenantId(req.user, overrideTenantId);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachTenant };
