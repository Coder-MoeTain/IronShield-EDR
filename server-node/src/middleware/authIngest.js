const config = require('../config');

/**
 * Simple ingest auth for external telemetry producers (Phase 3).
 * Require X-Ingest-Key header to match XDR_INGEST_KEY.
 */
function authIngest(req, res, next) {
  const expected = config.ingest?.key;
  if (!expected) {
    return res.status(503).json({ error: 'Ingest disabled (XDR_INGEST_KEY not set)' });
  }
  const got = req.headers['x-ingest-key'];
  if (!got || String(got) !== String(expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { authIngest };

