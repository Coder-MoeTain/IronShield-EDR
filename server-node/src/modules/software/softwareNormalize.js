/**
 * Normalize software names/vendors for matching.
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeVendor(vendor) {
  return normalizeName(vendor || '');
}

function computeFingerprint({ name, vendor, version, installLocation, endpointId }) {
  const crypto = require('crypto');
  const payload = [
    normalizeName(name),
    normalizeVendor(vendor),
    String(version || '').trim(),
    String(installLocation || '').toLowerCase().trim(),
    String(endpointId || ''),
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 64);
}

const BROWSER_PATTERNS = [/chrome/i, /firefox/i, /edge/i, /safari/i, /opera/i, /brave/i];
const EMAIL_PATTERNS = [/outlook/i, /thunderbird/i, /mail/i];
const PRIVILEGED_PATTERNS = [/powershell/i, /putty/i, /winscp/i, /teamviewer/i, /anydesk/i, /vnc/i];

function isBrowserSoftware(name) {
  return BROWSER_PATTERNS.some((p) => p.test(name || ''));
}

function isEmailClient(name) {
  return EMAIL_PATTERNS.some((p) => p.test(name || ''));
}

function isPrivilegedTool(name) {
  return PRIVILEGED_PATTERNS.some((p) => p.test(name || ''));
}

module.exports = {
  normalizeName,
  normalizeVendor,
  computeFingerprint,
  isBrowserSoftware,
  isEmailClient,
  isPrivilegedTool,
};
