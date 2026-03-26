const AnalyticsMlService = require('../services/AnalyticsMlService');

async function detectionSummary(req, res, next) {
  try {
    const data = await AnalyticsMlService.detectionSummary(req.tenantId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function detectionQualitySummary(req, res, next) {
  try {
    const data = await AnalyticsMlService.detectionQualitySummary(req.tenantId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { detectionSummary, detectionQualitySummary };
