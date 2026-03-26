/**
 * Enrollment token service (per-tenant bootstrap for agent registration).
 * Stores only SHA-256(token) in DB; the plaintext token is returned once at creation.
 */
const crypto = require('crypto');
const db = require('../utils/db');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function create({ tenantId, name, createdBy, expiresAt = null }) {
  if (!tenantId) throw new Error('tenantId required');
  if (!name) throw new Error('name required');
  const token = generateToken();
  const tokenHash = sha256Hex(token);
  await db.execute(
    `INSERT INTO tenant_enrollment_tokens (tenant_id, name, token_hash, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, String(name).substring(0, 128), tokenHash, createdBy ? String(createdBy).substring(0, 128) : null, expiresAt]
  );
  return { token, tokenHash };
}

async function list(tenantId) {
  return db.query(
    `SELECT id, tenant_id, name, token_hash, created_by, created_at, expires_at, revoked_at, last_used_at
     FROM tenant_enrollment_tokens
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId]
  );
}

async function revoke(tenantId, id) {
  const r = await db.execute(
    `UPDATE tenant_enrollment_tokens
     SET revoked_at = NOW()
     WHERE tenant_id = ? AND id = ? AND revoked_at IS NULL`,
    [tenantId, id]
  );
  return r.affectedRows > 0;
}

async function resolveToken(token) {
  const tokenHash = sha256Hex(token);
  const row = await db.queryOne(
    `SELECT id, tenant_id, expires_at, revoked_at
     FROM tenant_enrollment_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  await db.execute('UPDATE tenant_enrollment_tokens SET last_used_at = NOW() WHERE id = ?', [row.id]);
  return { tenantId: row.tenant_id, tokenId: row.id };
}

module.exports = { create, list, revoke, resolveToken };

