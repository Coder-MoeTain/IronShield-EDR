/**
 * Multi-tenant middleware - attaches tenant context to request
 */
const TenantService = require('../services/TenantService');

async function attachTenant(req, res, next) {
  if (!req.user) return next();
  try {
    req.tenantId = await TenantService.getEffectiveTenantId(req.user);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachTenant };
