const MitreCoverageService = require('../services/MitreCoverageService');

async function getCoverage(req, res, next) {
  try {
    const data = await MitreCoverageService.getCoverage(req.tenantId ?? null);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getCoverage };
