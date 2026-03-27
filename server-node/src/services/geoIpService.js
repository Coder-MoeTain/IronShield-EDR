/**
 * Offline IP → country / lat-lng using MaxMind GeoLite (geoip-lite).
 */
const geoip = require('geoip-lite');

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return null;
  let s = ip.trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  if (s === '::1' || s === 'localhost') return null;
  return s;
}

function lookupOne(ip) {
  const n = normalizeIp(ip);
  if (!n) return null;
  const l = geoip.lookup(n);
  if (!l || !Array.isArray(l.ll) || l.ll.length < 2) return null;
  return {
    lat: l.ll[0],
    lng: l.ll[1],
    country: l.country || null,
    countryCode: l.country || null,
    region: l.region || null,
    city: l.city || null,
  };
}

/**
 * @param {string[]} ips
 * @returns {Array<{ ip: string, lat: number|null, lng: number|null, country: string|null, countryCode: string|null }>}
 */
function batchLookup(ips) {
  const results = [];
  const seen = new Set();
  for (const raw of ips) {
    const n = normalizeIp(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const g = lookupOne(n);
    if (g) {
      results.push({ ip: n, ...g });
    } else {
      results.push({ ip: n, lat: null, lng: null, country: null, countryCode: null });
    }
  }
  return results;
}

module.exports = { normalizeIp, lookupOne, batchLookup };
