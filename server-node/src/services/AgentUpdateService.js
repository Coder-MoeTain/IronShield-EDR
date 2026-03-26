/**
 * Agent auto-update - version check and release info
 */
const db = require('../utils/db');

function parseVersion(v) {
  if (!v) return [0, 0, 0];
  const parts = String(v).replace(/^v/, '').split('.').map(Number);
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

async function getCurrentRelease() {
  return db.queryOne(
    'SELECT * FROM agent_releases WHERE is_current = 1 LIMIT 1'
  );
}

async function checkUpdate(currentVersion) {
  const release = await getCurrentRelease();
  if (!release) return { update_available: false };
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
  };
}

module.exports = { checkUpdate, getCurrentRelease };
