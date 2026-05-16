/**
 * Global error handler — standard error envelope (Phase 1).
 */
const logger = require('../utils/logger');
const { ERROR_CODES, HttpError, sendError, requestIdFromReq } = require('../utils/apiResponse');

function errorHandler(err, req, res, _next) {
  logger.error({ err, path: req.path }, 'Request error');

  const requestId = requestIdFromReq(req);

  if (err instanceof HttpError) {
    return sendError(res, err.code, err.message, {
      status: err.statusCode,
      details: err.details,
      requestId,
    });
  }

  if (err.code === 'TENANT_CONTEXT_REQUIRED') {
    return sendError(res, ERROR_CODES.TENANT_CONTEXT_REQUIRED, err.message, {
      status: err.statusCode || 403,
      requestId,
    });
  }

  if (err.code === 'PERMISSION_DENIED') {
    return sendError(res, ERROR_CODES.PERMISSION_DENIED, err.message, {
      status: err.statusCode || 403,
      requestId,
    });
  }

  const status = err.statusCode || err.status || 500;
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  const body = sendError(res, ERROR_CODES.INTERNAL_ERROR, message, {
    status,
    requestId,
    details:
      process.env.NODE_ENV === 'development' && err.stack
        ? { stack: err.stack }
        : undefined,
  });

  return body;
}

module.exports = errorHandler;
