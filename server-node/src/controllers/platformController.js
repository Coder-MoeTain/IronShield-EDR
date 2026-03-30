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

module.exports = {
  getProtectionCapabilities,
};
