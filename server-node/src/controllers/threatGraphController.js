const ThreatGraphService = require('../services/ThreatGraphService');

async function getGraph(req, res, next) {
  try {
    const data = await ThreatGraphService.buildGraph(req.tenantId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = { getGraph };
