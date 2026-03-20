/**
 * Antivirus signature service - signatures and bundles
 */
const db = require('../../utils/db');
const crypto = require('crypto');

async function listSignatures(filters = {}) {
  let sql = 'SELECT * FROM av_signatures WHERE 1=1';
  const params = [];
  if (filters.tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(filters.tenantId);
  }
  if (filters.enabled != null) {
    sql += ' AND enabled = ?';
    params.push(filters.enabled ? 1 : 0);
  }
  if (filters.family) {
    sql += ' AND family = ?';
    params.push(filters.family);
  }
  sql += ' ORDER BY family, name';
  const limit = Math.min(parseInt(filters.limit) || 500, 2000);
  sql += ' LIMIT ?';
  params.push(limit);
  return db.query(sql, params);
}

async function getActiveBundle() {
  return db.queryOne(
    'SELECT * FROM av_signature_bundles WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  );
}

async function getSignaturesForBundle(bundleVersion) {
  const bundle = await db.queryOne(
    'SELECT id FROM av_signature_bundles WHERE bundle_version = ? AND is_active = 1',
    [bundleVersion]
  );
  if (!bundle) return [];
  const links = await db.query(
    'SELECT signature_id FROM av_bundle_signatures WHERE bundle_id = ?',
    [bundle.id]
  );
  if (links.length === 0) {
    return db.query('SELECT * FROM av_signatures WHERE enabled = 1');
  }
  const ids = links.map((l) => l.signature_id);
  const placeholders = ids.map(() => '?').join(',');
  return db.query(`SELECT * FROM av_signatures WHERE id IN (${placeholders}) AND enabled = 1`, ids);
}

async function getHashSignatures() {
  return db.query(
    "SELECT signature_uuid, name, hash_value, hash_type, family, severity FROM av_signatures WHERE signature_type = 'hash' AND enabled = 1"
  );
}

async function createSignature(data, tenantId = null) {
  const uuid = data.signature_uuid || crypto.randomUUID();
  await db.execute(
    `INSERT INTO av_signatures (tenant_id, signature_uuid, name, signature_type, pattern, hash_value, hash_type, family, severity, description, enabled, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      uuid,
      data.name || 'Unnamed',
      data.signature_type || 'hash',
      data.pattern || null,
      data.hash_value || null,
      data.hash_type || 'sha256',
      data.family || null,
      data.severity || 'medium',
      data.description || null,
      data.enabled !== false ? 1 : 0,
      data.version || 1,
    ]
  );
  return uuid;
}

async function createBundle(signatureIds = [], releaseNotes = '') {
  const sigs = await db.query('SELECT id FROM av_signatures WHERE enabled = 1');
  const ids = signatureIds.length > 0 ? signatureIds : sigs.map((s) => s.id);
  const version = `v${Date.now()}`;

  const bundleResult = await db.execute(
    'INSERT INTO av_signature_bundles (bundle_version, signature_count, release_notes, is_active) VALUES (?, ?, ?, 0)',
    [version, ids.length, releaseNotes]
  );
  const bundleId = bundleResult.insertId;

  await db.execute('UPDATE av_signature_bundles SET is_active = 0 WHERE id != ?', [bundleId]);

  for (const sigId of ids) {
    await db.execute('INSERT INTO av_bundle_signatures (bundle_id, signature_id) VALUES (?, ?)', [
      bundleId,
      sigId,
    ]);
  }

  await db.execute('UPDATE av_signature_bundles SET is_active = 1 WHERE id = ?', [bundleId]);
  return version;
}

async function lookupHash(hash) {
  if (!hash || typeof hash !== 'string') return null;
  const h = hash.toLowerCase().trim();
  return db.queryOne(
    "SELECT * FROM av_signatures WHERE signature_type = 'hash' AND LOWER(hash_value) = ? AND enabled = 1",
    [h]
  );
}

async function getById(id, tenantId = null) {
  let sql = 'SELECT * FROM av_signatures WHERE id = ?';
  const params = [id];
  if (tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(tenantId);
  }
  return db.queryOne(sql, params);
}

async function updateSignature(id, data, tenantId = null) {
  const existing = await getById(id, tenantId);
  if (!existing) return null;

  await db.execute(
    `UPDATE av_signatures SET
      name = COALESCE(?, name),
      signature_type = COALESCE(?, signature_type),
      pattern = COALESCE(?, pattern),
      hash_value = COALESCE(?, hash_value),
      hash_type = COALESCE(?, hash_type),
      family = COALESCE(?, family),
      severity = COALESCE(?, severity),
      description = COALESCE(?, description),
      enabled = COALESCE(?, enabled),
      version = COALESCE(?, version),
      updated_at = NOW()
    WHERE id = ?`,
    [
      data.name,
      data.signature_type,
      data.pattern,
      data.hash_value,
      data.hash_type || 'sha256',
      data.family,
      data.severity,
      data.description,
      data.enabled != null ? (data.enabled ? 1 : 0) : null,
      data.version,
      id,
    ]
  );
  return getById(id, tenantId);
}

module.exports = {
  listSignatures,
  getActiveBundle,
  getSignaturesForBundle,
  getHashSignatures,
  createSignature,
  createBundle,
  lookupHash,
  getById: getById,
  updateSignature,
};
