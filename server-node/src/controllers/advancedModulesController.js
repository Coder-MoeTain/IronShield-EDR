const AdvancedModulesService = require('../services/AdvancedModulesService');

const ALLOWED = new Set(['identity', 'exposure', 'managed-hunting', 'prevention-deep', 'integrations']);

async function getModule(req, res, next) {
  try {
    const { area } = req.params;
    if (!ALLOWED.has(area)) {
      return res.status(404).json({ error: 'Unknown module' });
    }
    const payload = await AdvancedModulesService.getModule(area, req.tenantId);
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

module.exports = { getModule };
