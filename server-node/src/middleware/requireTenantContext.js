/**
 * Enterprise guard: require tenant context for non-super_admin users.
 * Prevents accidental "tenantId = null => all tenants" behavior.
 */
function requireTenantContext(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role === 'super_admin') return next();
  if (req.tenantId == null) return res.status(403).json({ error: 'Tenant context required' });
  return next();
}

module.exports = { requireTenantContext };

