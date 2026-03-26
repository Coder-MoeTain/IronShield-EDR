/**
 * Threat intel feed status (free community IP blocklists)
 */
const ThreatIntelFeedService = require('../services/ThreatIntelFeedService');

async function getStatus(req, res, next) {
  try {
    res.json(ThreatIntelFeedService.getStatus());
  } catch (err) {
    next(err);
  }
}

async function postRefresh(req, res, next) {
  try {
    await ThreatIntelFeedService.refresh();
    res.json(ThreatIntelFeedService.getStatus());
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatus, postRefresh };
