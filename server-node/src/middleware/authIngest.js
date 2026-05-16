const config = require('../config');
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');

/**
 * Simple ingest auth for external telemetry producers (Phase 3).
 * Require X-Ingest-Key header to match XDR_INGEST_KEY.
 */
function authIngest(req, res, next) {
  const expected = config.ingest?.key;
  if (!expected) {
    return sendErrorFromReq(
      res,
      req,
      ERROR_CODES.INTERNAL_ERROR,
      'Ingest disabled (XDR_INGEST_KEY not set)',
      503
    );
  }
  const got = req.headers['x-ingest-key'];
  if (!got || String(got) !== String(expected)) {
    return sendErrorFromReq(res, req, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Unauthorized', 401);
  }
  next();
}

module.exports = { authIngest };

