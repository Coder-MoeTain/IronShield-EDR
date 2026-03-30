/**
 * Admin: Web & URL protection — blocklist + IOC rows for management UI.
 */
const WebUrlBlocklistService = require('../services/WebUrlBlocklistService');

async function getWebUrlConfig(req, res, next) {
  try {
    const tenantId = req.tenantId;
    const [blocklist, iocs] = await Promise.all([
      WebUrlBlocklistService.getBlocklistForTenant(tenantId),
      WebUrlBlocklistService.listUrlIocRows(tenantId),
    ]);
    res.json({
      ...blocklist,
      iocs,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWebUrlConfig,
};
