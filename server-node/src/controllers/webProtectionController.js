/**
 * Agent Web & URL protection — blocklist derived from IOC watchlist.
 */
const EndpointService = require('../services/EndpointService');
const WebUrlBlocklistService = require('../services/WebUrlBlocklistService');

async function getWebBlocklist(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const body = await WebUrlBlocklistService.getForEndpoint(endpoint);
    res.json(body);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWebBlocklist,
};
