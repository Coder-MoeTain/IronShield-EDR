const AuditLogService = require('../services/AuditLogService');

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const SENSITIVE_KEYS = new Set([
    'password',
    'new_password',
    'jwt',
    'token',
    'refresh_token',
    'authorization',
    'secret',
    'api_key',
    'apikey',
    'auth_header_value',
    'registrationtoken',
    'registration_token',
  ]);
  if (Array.isArray(obj)) return obj.map((x) => redact(x));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) out[k] = '[REDACTED]';
    else out[k] = redact(v);
  }
  return out;
}

/**
 * Immutable admin action trail (write-only):
 * - logs *every* /api/admin request after auth + tenant attach
 * - redacts secrets
 * - stores request metadata + response status
 */
function adminAuditTrail(req, res, next) {
  const startedAt = Date.now();
  const body = req.body ? redact(req.body) : null;
  const query = req.query ? redact(req.query) : null;

  res.on('finish', async () => {
    try {
      const userId = req.user?.userId ?? null;
      const username = req.user?.username ?? null;
      const action = `${req.method} ${req.baseUrl || ''}${req.path || ''}`.trim();
      await AuditLogService.log({
        userId,
        username,
        action,
        resourceType: 'admin_api',
        resourceId: null,
        details: {
          tenantId: req.tenantId ?? null,
          status: res.statusCode,
          ms: Date.now() - startedAt,
          query,
          body,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch {
      // never break requests on audit failures
    }
  });

  next();
}

module.exports = { adminAuditTrail };

