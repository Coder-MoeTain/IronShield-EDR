/**
 * Build display URLs for web telemetry rows (IP + port only in DB).
 * Uses reverse DNS (PTR) when available; otherwise encodes IP literals (IPv6 bracketed).
 */
const dns = require('dns').promises;

const ptrCache = new Map();

/**
 * @param {string} ip
 * @returns {Promise<string|null>}
 */
async function reverseLookupHostname(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const key = ip.trim();
  if (ptrCache.has(key)) {
    const v = ptrCache.get(key);
    return v === undefined ? null : v;
  }
  try {
    const names = await dns.reverse(key);
    const n = names?.[0] ? String(names[0]).replace(/\.$/, '').trim() : null;
    const use = n && !looksLikeIpLiteral(n) ? n : null;
    ptrCache.set(key, use);
    return use;
  } catch {
    ptrCache.set(key, null);
    return null;
  }
}

function looksLikeIpLiteral(s) {
  return /^[\d.:a-fA-F]+$/i.test(s) && s.length < 48;
}

function schemeAndPortSuffix(port) {
  const p = Number(port);
  const n = Number.isFinite(p) ? p : 443;
  if (n === 80) return { scheme: 'http', suffix: '' };
  if (n === 443) return { scheme: 'https', suffix: '' };
  if (n === 8080) return { scheme: 'http', suffix: ':8080' };
  if (n === 8000) return { scheme: 'http', suffix: ':8000' };
  if (n === 8888) return { scheme: 'http', suffix: ':8888' };
  if (n === 8443) return { scheme: 'https', suffix: ':8443' };
  return { scheme: 'https', suffix: `:${n}` };
}

/**
 * Host part for URL authority: PTR name, or IPv4, or [IPv6].
 */
function authorityHost(ip, hostname) {
  if (hostname && hostname.length > 0 && hostname.length <= 253) {
    if (!looksLikeIpLiteral(hostname) && /^[a-zA-Z0-9_.-]+$/.test(hostname)) {
      return hostname;
    }
  }
  const ipStr = String(ip || '').trim();
  if (!ipStr) return '';
  const lower = ipStr.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const v4 = ipStr.slice(7);
    if (!v4.includes(':')) return v4;
  }
  if (ipStr.includes(':')) {
    return `[${ipStr}]`;
  }
  return ipStr;
}

/**
 * @param {string} ip
 * @param {number|string} port
 * @param {string|null|undefined} resolvedHostname
 * @returns {string}
 */
function buildDestinationUrl(ip, port, resolvedHostname) {
  const { scheme, suffix } = schemeAndPortSuffix(port);
  const host = authorityHost(ip, resolvedHostname);
  if (!host) return '';
  return `${scheme}://${host}${suffix}`;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function enrichWebDestinationRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const uniq = [...new Set(rows.map((r) => r.remote_address).filter((a) => a != null && String(a).trim()).map(String))];
  const ipToHost = new Map();
  const batch = 32;
  for (let i = 0; i < uniq.length; i += batch) {
    const chunk = uniq.slice(i, i + batch);
    await Promise.all(
      chunk.map(async (ip) => {
        const h = await reverseLookupHostname(ip);
        ipToHost.set(ip, h);
      })
    );
  }

  return rows.map((r) => {
    const ip = r.remote_address != null ? String(r.remote_address).trim() : '';
    const hn = ip ? ipToHost.get(ip) ?? null : null;
    const destination_url = buildDestinationUrl(ip, r.remote_port, hn);
    return {
      ...r,
      resolved_hostname: hn,
      destination_url,
    };
  });
}

module.exports = {
  enrichWebDestinationRows,
  buildDestinationUrl,
  reverseLookupHostname,
};
