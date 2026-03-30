/**
 * Builds domain blocklists for the Windows agent Web & URL protection (hosts-file sinkhole).
 * Sources: IOC watchlist entries of type domain and url (tenant + global).
 */
const crypto = require('crypto');
const db = require('../utils/db');
const AvPolicyService = require('../modules/antivirus/avPolicyService');

function normalizeDomain(s) {
  let d = String(s || '')
    .trim()
    .toLowerCase();
  if (!d) return null;
  if (d.endsWith('.')) d = d.slice(0, -1);
  if (d.includes('*') || d.includes(' ') || d.includes('/')) return null;
  if (d === 'localhost' || d === 'localhost.localdomain') return null;
  const labels = d.split('.');
  if (labels.length < 2) return null;
  for (const lab of labels) {
    if (!lab || lab.length > 63) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(lab)) return null;
  }
  if (d.length > 253) return null;
  return d;
}

function extractHost(iocType, iocValue) {
  const v = String(iocValue || '').trim();
  if (!v) return null;
  if (iocType === 'domain') return normalizeDomain(v);
  if (iocType === 'url') {
    try {
      const u = new URL(v.includes('://') ? v : `https://${v}`);
      if (!u.hostname) return null;
      return normalizeDomain(u.hostname);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {object} endpoint - row from endpoints (needs tenant_id)
 * @returns {Promise<{ enabled: boolean, version: string, domains: string[] }>}
 */
async function getForEndpoint(endpoint) {
  const policy = await AvPolicyService.getForEndpoint(endpoint.id);
  const enabled = policy && policy.web_url_protection_enabled === false ? false : true;

  const rows = await db.query(
    `SELECT ioc_type, ioc_value FROM ioc_watchlist
     WHERE is_active = 1 AND ioc_type IN ('domain', 'url')
       AND (tenant_id IS NULL OR tenant_id = ?)`,
    [endpoint.tenant_id]
  );

  const domains = new Set();
  for (const r of rows) {
    const h = extractHost(r.ioc_type, r.ioc_value);
    if (h) domains.add(h);
  }

  const list = [...domains].sort();
  const version = crypto.createHash('sha256').update(list.join('|')).digest('hex').slice(0, 24);

  return { enabled, version, domains: list };
}

/**
 * Console / tenant-wide blocklist (same domains agents receive; policy from av_scan_policies).
 */
async function getBlocklistForTenant(tenantId) {
  let sql = `
    SELECT ioc_type, ioc_value FROM ioc_watchlist
     WHERE is_active = 1 AND ioc_type IN ('domain', 'url')`;
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  const rows = await db.query(sql, params);

  const domains = new Set();
  for (const r of rows) {
    const h = extractHost(r.ioc_type, r.ioc_value);
    if (h) domains.add(h);
  }
  const list = [...domains].sort();
  const version = crypto.createHash('sha256').update(list.join('|')).digest('hex').slice(0, 24);

  let pol;
  if (tenantId != null) {
    pol = await db.queryOne(
      `SELECT web_url_protection_enabled FROM av_scan_policies
       WHERE (tenant_id IS NULL OR tenant_id = ?)
       ORDER BY CASE WHEN tenant_id <=> ? THEN 0 ELSE 1 END, id DESC
       LIMIT 1`,
      [tenantId, tenantId]
    );
  } else {
    pol = await db.queryOne(
      `SELECT web_url_protection_enabled FROM av_scan_policies ORDER BY id DESC LIMIT 1`
    );
  }
  const enabled = pol && pol.web_url_protection_enabled === false ? false : true;

  return { enabled, version, domains: list };
}

async function listUrlIocRows(tenantId) {
  let sql = `
    SELECT id, ioc_type, ioc_value, description, severity, created_at
     FROM ioc_watchlist
     WHERE is_active = 1 AND ioc_type IN ('domain', 'url')`;
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  sql += ` ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low'), id DESC`;
  return db.query(sql, params);
}

module.exports = {
  getForEndpoint,
  getBlocklistForTenant,
  listUrlIocRows,
  extractHost,
  normalizeDomain,
};
