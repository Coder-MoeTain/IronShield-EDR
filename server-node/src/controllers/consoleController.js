const ConsoleBffService = require('../services/ConsoleBffService');

function tenantId(req) {
  return req.tenantId ?? null;
}

async function overview(req, res, next) {
  try {
    const data = await ConsoleBffService.getOverview(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function endpoints(req, res, next) {
  try {
    const data = await ConsoleBffService.getEndpoints(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function endpointDetail(req, res, next) {
  try {
    const data = await ConsoleBffService.getEndpointDetail(req.params.id, tenantId(req));
    if (!data.endpoint) return res.status(404).json({ error: 'Endpoint not found' });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function detections(req, res, next) {
  try {
    const data = await ConsoleBffService.getDetections(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function investigation(req, res, next) {
  try {
    const data = await ConsoleBffService.getInvestigation(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function response(req, res, next) {
  try {
    const data = await ConsoleBffService.getResponse(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function hunting(req, res, next) {
  try {
    const data = await ConsoleBffService.getHunting(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function protection(req, res, next) {
  try {
    const data = await ConsoleBffService.getProtection(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function admin(req, res, next) {
  try {
    const data = await ConsoleBffService.getAdmin(tenantId(req));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  overview,
  endpoints,
  endpointDetail,
  detections,
  investigation,
  response,
  hunting,
  protection,
  admin,
};
