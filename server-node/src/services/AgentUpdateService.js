/**
 * Agent auto-update - version check and release info
 */
const db = require('../utils/db');

function parseVersion(v) {
  if (!v) return [0, 0, 0];
  const cleaned = String(v).trim().replace(/^v/i, '').split('-')[0];
  const parts = cleaned.split('.').map((x) => parseInt(x, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewer(current, available) {
  const c = parseVersion(current);
  const a = parseVersion(available);
  for (let i = 0; i < 3; i++) {
    if (a[i] > c[i]) return true;
    if (a[i] < c[i]) return false;
  }
  return false;
}

function isValidReleaseForDelivery(release) {
  if (!release) return false;
  const versionOk = /^v?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(release.version || '').trim());
  const urlOk = /^https:\/\//i.test(String(release.download_url || '').trim());
  const checksumOk = /^[a-f0-9]{64}$/i.test(String(release.checksum_sha256 || '').trim());
  return versionOk && urlOk && checksumOk;
}

async function getCurrentRelease() {
  return db.queryOne(
    'SELECT * FROM agent_releases WHERE is_current = 1 LIMIT 1'
  );
}

async function getTargetRelease({ tenantId = null, ring = 'stable' } = {}) {
  // Prefer tenant-scoped current release for a ring, then global.
  const r = await db.queryOne(
    `SELECT * FROM agent_releases
     WHERE is_current = 1 AND ring = ? AND (tenant_id <=> ? OR tenant_id IS NULL)
     ORDER BY CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END, created_at DESC
     LIMIT 1`,
    [String(ring || 'stable'), tenantId]
  );
  if (r) return r;
  return db.queryOne('SELECT * FROM agent_releases WHERE is_current = 1 ORDER BY created_at DESC LIMIT 1');
}

async function checkUpdate(currentVersion, { tenantId = null, ring = 'stable' } = {}) {
  const release = await getTargetRelease({ tenantId, ring });
  if (!release) return { update_available: false };
  if (!isValidReleaseForDelivery(release)) {
    return { update_available: false, reason: 'invalid_release_metadata' };
  }
  if (!isNewer(currentVersion, release.version)) {
    return { update_available: false };
  }
  return {
    update_available: true,
    version: release.version,
    download_url: release.download_url,
    checksum_sha256: release.checksum_sha256,
    signature_base64: release.signature_base64 || null,
    release_notes: release.release_notes,
    ring: release.ring || 'stable',
    health_gate: release.health_gate || null,
  };
}

module.exports = {
  checkUpdate,
  getCurrentRelease,
  getTargetRelease,
  _parseVersion: parseVersion,
  _isNewer: isNewer,
  _isValidReleaseForDelivery: isValidReleaseForDelivery,
};
