const ConsoleBffService = require('../services/ConsoleBffService');
const { sendSuccess, requestIdFromReq } = require('../utils/apiResponse');

function tenantId(req) {
  return req.tenantId ?? null;
}

function bffSuccess(res, req, data, status = 200) {
  return sendSuccess(res, data, { status, requestId: requestIdFromReq(req) });
}

async function overview(req, res, next) {
  try {
    const data = await ConsoleBffService.getOverview(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function endpoints(req, res, next) {
  try {
    const data = await ConsoleBffService.getEndpoints(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function endpointDetail(req, res, next) {
  try {
    const data = await ConsoleBffService.getEndpointDetail(req.params.id, tenantId(req));
    if (!data.endpoint) {
      const { sendErrorFromReq, ERROR_CODES } = require('../utils/apiResponse');
      return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Endpoint not found', 404);
    }
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function detections(req, res, next) {
  try {
    const data = await ConsoleBffService.getDetections(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function investigation(req, res, next) {
  try {
    const data = await ConsoleBffService.getInvestigation(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function response(req, res, next) {
  try {
    const data = await ConsoleBffService.getResponse(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function hunting(req, res, next) {
  try {
    const data = await ConsoleBffService.getHunting(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function protection(req, res, next) {
  try {
    const data = await ConsoleBffService.getProtection(tenantId(req));
    return bffSuccess(res, req, data);
  } catch (e) {
    next(e);
  }
}

async function admin(req, res, next) {
  try {
    const data = await ConsoleBffService.getAdmin(tenantId(req));
    return bffSuccess(res, req, data);
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
