/**
 * Platform capability endpoints (honest product mapping for the console).
 */
const { getCapabilitiesCatalog } = require('../modules/platform/protectionCapabilities');

async function getProtectionCapabilities(req, res, next) {
  try {
    const catalog = getCapabilitiesCatalog();
    res.json({
      ...catalog,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

async function getProductionReadiness(req, res, next) {
  try {
    const ProductionReadinessService = require('../services/ProductionReadinessService');
    const data = await ProductionReadinessService.getScore();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getTelemetryQuality(req, res, next) {
  try {
    const TelemetryQualityService = require('../services/TelemetryQualityService');
    const endpointId = req.query.endpoint_id;
    if (endpointId) {
      const data = await TelemetryQualityService.scoreEndpoint(endpointId);
      return res.json(data || { error: 'not_found' });
    }
    const data = await TelemetryQualityService.listScores(req.tenantId ?? null, 50);
    res.json({ scores: data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProtectionCapabilities,
  getProductionReadiness,
  getTelemetryQuality,
};
