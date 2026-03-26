/**
 * Enrollment token controller (admin)
 */
const EnrollmentTokenService = require('../services/EnrollmentTokenService');

async function listTokens(req, res, next) {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const rows = await EnrollmentTokenService.list(tenantId);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function createToken(req, res, next) {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const { name, expires_at } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const createdBy = req.user?.username || req.user?.userId || null;
    const { token } = await EnrollmentTokenService.create({
      tenantId,
      name,
      createdBy,
      expiresAt: expires_at ? new Date(expires_at) : null,
    });
    // Return plaintext token once (do not store plaintext).
    res.status(201).json({ token });
  } catch (e) {
    next(e);
  }
}

async function revokeToken(req, res, next) {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const id = parseInt(req.params.id, 10);
    if (!tenantId || !id) return res.status(400).json({ error: 'tenantId and id required' });
    const ok = await EnrollmentTokenService.revoke(tenantId, id);
    if (!ok) return res.status(404).json({ error: 'Token not found (or already revoked)' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { listTokens, createToken, revokeToken };

