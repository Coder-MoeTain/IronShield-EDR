/**
 * Network activity API
 */
const NetworkService = require('../services/NetworkService');

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

async function getNetworkLogs(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const connections = await NetworkService.listConnections({ ...filters, limit: 200 });
    const events = await NetworkService.getNetworkEventsFromNormalized(filters);
    res.json({ connections, events });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConnections,
  getOutgoingIps,
  getTrafficSummary,
  getNetworkLogs,
};
