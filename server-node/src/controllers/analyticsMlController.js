const AnalyticsMlService = require('../services/AnalyticsMlService');

async function detectionSummary(req, res, next) {
  try {
    const data = await AnalyticsMlService.detectionSummary(req.tenantId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { detectionSummary };
