/**
 * Detection rules controller - enterprise multi-tenant
 */
const DetectionRulesService = require('../services/DetectionRulesService');

async function list(req, res, next) {
  try {
    const rules = await DetectionRulesService.list(req.tenantId);
    res.json(rules);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const rule = await DetectionRulesService.getById(req.params.id, req.tenantId);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { tenant_id, ...data } = req.body || {};
    const tenantId = req.user?.role === 'super_admin' && tenant_id != null ? tenant_id : req.tenantId;
    const id = await DetectionRulesService.create(data, tenantId);
    const rule = await DetectionRulesService.getById(id, tenantId);
    res.status(201).json(rule);
  } catch (err) {
    if (err.message?.includes('required')) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const rule = await DetectionRulesService.update(req.params.id, req.body || {}, req.tenantId);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const deleted = await DetectionRulesService.remove(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Rule not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
