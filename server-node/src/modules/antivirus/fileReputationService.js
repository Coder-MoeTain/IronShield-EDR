/**
 * File reputation service - lookup by SHA256 across scan results and signatures
 */
const db = require('../../utils/db');
const AvSignatureService = require('./avSignatureService');

async function getReputation(sha256, tenantId = null) {
  if (!sha256 || typeof sha256 !== 'string') return null;
  const hash = sha256.toLowerCase().trim();

  const sig = await AvSignatureService.lookupHash(hash);
  if (sig) {
    return {
      sha256: hash,
      reputation: 'malicious',
      source: 'signature',
      signature_name: sig.name,
      family: sig.family,
      severity: sig.severity,
      first_seen: null,
      last_seen: null,
      detection_count: 0,
      endpoint_count: 0,
    };
  }

  const [detections] = await db.query(
    `SELECT COUNT(*) as c, COUNT(DISTINCT endpoint_id) as endpoints, MIN(scan_time) as first_seen, MAX(scan_time) as last_seen
     FROM av_scan_results WHERE LOWER(sha256) = ?`,
    [hash]
  );
  const d = detections?.[0];
  const count = Number(d?.c ?? 0);
  const endpointCount = Number(d?.endpoints ?? 0);

  if (count === 0) {
    return {
      sha256: hash,
      reputation: 'unknown',
      source: null,
      first_seen: null,
      last_seen: null,
      detection_count: 0,
      endpoint_count: 0,
    };
  }

  const [maxSeverity] = await db.query(
    `SELECT severity FROM av_scan_results WHERE LOWER(sha256) = ? ORDER BY
      FIELD(severity, 'critical', 'high', 'medium', 'low') LIMIT 1`,
    [hash]
  );
  const severity = maxSeverity?.[0]?.severity || 'medium';

  return {
    sha256: hash,
    reputation: ['critical', 'high'].includes(severity) ? 'malicious' : 'suspicious',
    source: 'scan_history',
    first_seen: d?.first_seen,
    last_seen: d?.last_seen,
    detection_count: count,
    endpoint_count: endpointCount,
    severity,
  };
}

async function search(filters = {}) {
  const { sha256, limit = 50 } = filters;
  if (sha256) {
    const rep = await getReputation(sha256, filters.tenantId);
    return rep ? [rep] : [];
  }

  const rows = await db.query(
    `SELECT sha256, COUNT(*) as detection_count, COUNT(DISTINCT endpoint_id) as endpoint_count,
      MAX(severity) as max_severity, MIN(scan_time) as first_seen, MAX(scan_time) as last_seen
     FROM av_scan_results WHERE sha256 IS NOT NULL AND sha256 != ''
     GROUP BY sha256 ORDER BY detection_count DESC LIMIT ?`,
    [Math.min(parseInt(limit) || 50, 200)]
  );

  const results = [];
  for (const r of rows) {
    const rep = await getReputation(r.sha256, filters.tenantId);
    if (rep) results.push(rep);
  }
  return results;
}

module.exports = {
  getReputation,
  search,
};
