/**
 * Wraps res.json success/error payloads in the standard API envelope when not already enveloped.
 * Applied to all /api and /api/v1 route groups. Ingest producers and the Windows agent
 * should accept { success, data } or legacy flat JSON (agent unwraps in HttpTransport).
 */
const { requestIdFromReq } = require('../utils/apiResponse');

function isEnveloped(body) {
  return !!(
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof body.success === 'boolean'
  );
}

function envelopeResponseMiddleware(req, res, next) {
  const origJson = res.json.bind(res);

  res.json = function envelopeJson(body) {
    if (isEnveloped(body)) {
      return origJson(body);
    }

    const requestId = requestIdFromReq(req);
    const status = res.statusCode || 200;

    if (status >= 400) {
      const message =
        typeof body?.error === 'string'
          ? body.error
          : body?.error?.message || body?.message || 'Request failed';
      const code = body?.error?.code || body?.code || 'REQUEST_FAILED';
      return origJson({
        success: false,
        error: {
          code,
          message,
          ...(body?.details != null && { details: body.details }),
          ...(body?.error?.details != null && { details: body.error.details }),
        },
        requestId,
      });
    }

    return origJson({
      success: true,
      data: body ?? {},
      requestId,
    });
  };

  next();
}

module.exports = { envelopeResponseMiddleware, isEnveloped };
