/**
 * Standard API JSON envelope (Phase 1).
 *
 * Success: { success: true, data, meta?, requestId? }
 * Error:   { success: false, error: { code, message, details? }, requestId? }
 */

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TENANT_CONTEXT_REQUIRED: 'TENANT_CONTEXT_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

class HttpError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function requestIdFromReq(req) {
  return req?.requestId || undefined;
}

function sendSuccess(res, data = null, options = {}) {
  const { status = 200, meta = undefined, requestId } = options;
  const body = {
    success: true,
    data: data ?? {},
    ...(meta !== undefined && { meta }),
    ...(requestId && { requestId }),
  };
  return res.status(status).json(body);
}

function sendError(res, code, message, options = {}) {
  const { status = 400, details = undefined, requestId } = options;
  const body = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && details !== null && { details }),
    },
    ...(requestId && { requestId }),
  };
  return res.status(status).json(body);
}

function sendErrorFromReq(res, req, code, message, status = 400, details = undefined) {
  return sendError(res, code, message, {
    status,
    details,
    requestId: requestIdFromReq(req),
  });
}

function legacyErrorPayload(message, requestId, details) {
  return {
    error: message,
    ...(requestId && { requestId }),
    ...(details !== undefined && { details }),
  };
}

module.exports = {
  ERROR_CODES,
  HttpError,
  sendSuccess,
  sendError,
  sendErrorFromReq,
  legacyErrorPayload,
  requestIdFromReq,
};
