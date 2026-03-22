/**
 * Phase B: optional per-tenant + IP request budget (in-memory; reset per minute).
 * Set TENANT_RPM (default 600) and ENABLE_TENANT_RATE_LIMIT=true to enforce.
 */
const buckets = new Map();

function tenantRateLimit(req, res, next) {
  if (process.env.ENABLE_TENANT_RATE_LIMIT !== 'true') return next();

  const max = Math.max(60, parseInt(process.env.TENANT_RPM || '600', 10));
  const tid = req.tenantId != null ? String(req.tenantId) : 'global';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const key = `${tid}:${ip}`;
  const now = Date.now();
  const win = 60 * 1000;

  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + win };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    return res.status(429).json({ error: 'Rate limit exceeded (tenant scope). Retry shortly.' });
  }
  next();
}

module.exports = { tenantRateLimit };
