/**
 * Network activity API
 */
const NetworkService = require('../services/NetworkService');
const geoIpService = require('../services/geoIpService');

async function listConnections(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await NetworkService.listConnections(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getOutgoingIps(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await NetworkService.getOutgoingIps(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getTrafficSummary(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await NetworkService.getTrafficSummary(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getNetworkSummary(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    if (filters.hours) filters.hours = parseInt(filters.hours, 10) || 24;
    const kpi = await NetworkService.getNetworkKpi(filters);
    res.json(kpi);
  } catch (err) {
    next(err);
  }
}

async function getNetworkLogs(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    if (filters.hours) filters.hours = parseInt(filters.hours, 10) || 24;
    const connections = await NetworkService.listConnections({ ...filters, limit: 200 });
    const events = await NetworkService.getNetworkEventsFromNormalized(filters);
    res.json({ connections, events });
  } catch (err) {
    next(err);
  }
}

/** Batch geolocate IPs for world map (geoip-lite, max 500). */
async function listWebDestinations(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    if (filters.hours) filters.hours = parseInt(filters.hours, 10) || 24;
    if (filters.endpointId) filters.endpointId = parseInt(filters.endpointId, 10) || undefined;
    const rows = await NetworkService.listWebDestinations(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function geoLookup(req, res, next) {
  try {
    const raw = Array.isArray(req.body?.ips) ? req.body.ips : [];
    const ips = raw.slice(0, 500).map((x) => String(x));
    const results = geoIpService.batchLookup(ips);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConnections,
  getOutgoingIps,
  getTrafficSummary,
  getNetworkSummary,
  getNetworkLogs,
  listWebDestinations,
  geoLookup,
};
