/**
 * Tenant management API - super_admin only
 */
const TenantService = require('../services/TenantService');

async function listTenants(req, res, next) {
  try {
    let tenants;
    if (req.user?.role === 'super_admin') {
      tenants = await TenantService.list();
    } else {
      const tenantIds = await TenantService.getTenantIdsForUser(req.user?.userId);
      if (!tenantIds || tenantIds.length === 0) {
        tenants = [];
      } else {
        const all = await TenantService.list();
        tenants = all.filter((t) => tenantIds.includes(t.id));
      }
    }
    const withCounts = await Promise.all(
      tenants.map(async (t) => ({
        ...t,
        endpoint_count: await TenantService.getEndpointCount(t.id),
      }))
    );
    res.json(withCounts);
  } catch (err) {
    next(err);
  }
}

async function getTenant(req, res, next) {
  try {
    const t = await TenantService.getById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    t.endpoint_count = await TenantService.getEndpointCount(t.id);
    res.json(t);
  } catch (err) {
    next(err);
  }
}

async function createTenant(req, res, next) {
  try {
    const { name, slug } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await TenantService.create({ name, slug });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function updateTenant(req, res, next) {
  try {
    await TenantService.update(req.params.id, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteTenant(req, res, next) {
  try {
    const deleted = await TenantService.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant,
};
