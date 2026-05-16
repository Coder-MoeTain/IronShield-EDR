const IntegrationService = require('../services/IntegrationService');

async function list(req, res, next) {
  try {
    const rows = await IntegrationService.list(req.tenantId ?? null);
    res.json({ integrations: rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { type, name, config } = req.body || {};
    const id = await IntegrationService.create({
      tenantId: req.tenantId ?? null,
      type,
      name,
      config: config || {},
      actor: req.user?.username,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function test(req, res, next) {
  try {
    const result = await IntegrationService.test(req.params.id, req.tenantId ?? null);
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, test };
