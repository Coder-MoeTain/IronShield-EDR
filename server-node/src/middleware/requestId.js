const crypto = require('crypto');

/**
 * Propagate or generate X-Request-ID for log correlation (SOC / IR).
 */
function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const id =
    typeof incoming === 'string' && incoming.trim().length > 0 && incoming.length <= 128
      ? incoming.trim()
      : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = { requestIdMiddleware };
