/**
 * Controller helpers for explicit standard envelope responses.
 */
const { sendSuccess, sendErrorFromReq, requestIdFromReq } = require('./apiResponse');

function ok(res, req, data = {}, status = 200, meta) {
  return sendSuccess(res, data, { status, meta, requestId: requestIdFromReq(req) });
}

function fail(res, req, code, message, status = 400, details) {
  return sendErrorFromReq(res, req, code, message, status, details);
}

module.exports = { ok, fail, requestIdFromReq };
