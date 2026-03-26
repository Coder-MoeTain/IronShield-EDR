const db = require('../utils/db');
const logger = require('../utils/logger');
const { addIoc } = require('./IocMatchingService');

const IPV4_RE =
  /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

/**
 * 10 recommended public IP feeds (no API key).
 * Notes:
 * - These are community feeds; validate licensing/terms for your environment.
 * - Some feeds may rate-limit or change format over time.
 */
const RECOMMENDED_IP_FEEDS = [
  {
    name: 'abuse.ch Feodo Tracker (recommended)',
    url: 'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt',
    severity: 'high',
  },
  {
    name: 'abuse.ch SSLBL (botnet C2 IPs)',
    url: 'https://sslbl.abuse.ch/blacklist/sslipblacklist.txt',
    severity: 'high',
  },
  {
    name: 'abuse.ch URLhaus (online hosts)',
    url: 'https://urlhaus.abuse.ch/downloads/hostfile/',
    severity: 'high',
  },
  {
    name: 'Emerging Threats compromised IPs',
    url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
    severity: 'high',
  },
  {
    name: 'IPsum (stamparm) level 1',
    url: 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/1.txt',
    severity: 'medium',
  },
  {
    name: 'IPsum (stamparm) level 2',
    url: 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/2.txt',
    severity: 'high',
  },
  {
    name: 'Blocklist.de attackers (all)',
    url: 'https://lists.blocklist.de/lists/all.txt',
    severity: 'medium',
  },
  {
    name: 'CINS Army (suspicious IP list)',
    url: 'https://cinsscore.com/list/ci-badguys.txt',
    severity: 'medium',
  },
  {
    name: 'Greensnow (blocklist)',
    url: 'https://blocklist.greensnow.co/greensnow.txt',
    severity: 'medium',
  },
  {
    name: 'BruteForceBlocker (public brute-force list)',
    url: 'https://danger.rulez.sk/projects/bruteforceblocker/blist.php',
    severity: 'medium',
  },
];

function uniq(arr) {
  return [...new Set(arr)];
}

function extractByJsonPath(obj, jsonPath) {
  if (!jsonPath) return null;
  const p = String(jsonPath).trim();
  if (!p) return null;
  const parts = p.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return null;
    cur = cur[part];
  }
  return cur;
}

async function listFeeds(tenantId = null) {
  if (tenantId != null) {
    return db.query(
      'SELECT * FROM xdr_ip_blacklist_feeds WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY id DESC',
      [tenantId]
    );
  }
  return db.query('SELECT * FROM xdr_ip_blacklist_feeds ORDER BY id DESC');
}

async function createFeed(feed, tenantId = null) {
  const name = String(feed?.name || '').trim();
  const url = String(feed?.url || '').trim();
  if (!name) throw new Error('name is required');
  if (!url) throw new Error('url is required');
  const authHeaderName = feed?.auth_header_name ? String(feed.auth_header_name).trim() : null;
  const authHeaderValue = feed?.auth_header_value ? String(feed.auth_header_value).trim() : null;
  const jsonPath = feed?.json_path ? String(feed.json_path).trim() : null;
  const severity = feed?.severity ? String(feed.severity).toLowerCase().trim() : 'high';
  const isActive = feed?.is_active === 0 || feed?.is_active === false ? 0 : 1;

  await db.execute(
    `INSERT INTO xdr_ip_blacklist_feeds (tenant_id, name, url, auth_header_name, auth_header_value, json_path, severity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, name, url, authHeaderName, authHeaderValue, jsonPath, severity, isActive]
  );
  const [row] = await db.query('SELECT * FROM xdr_ip_blacklist_feeds ORDER BY id DESC LIMIT 1');
  return row || null;
}

async function bootstrapRecommendedFeeds(tenantId = null) {
  // Deduplicate by URL (case-insensitive)
  const existing = await listFeeds(tenantId);
  const existingUrls = new Set((existing || []).map((f) => String(f.url || '').toLowerCase().trim()).filter(Boolean));

  let created = 0;
  for (const f of RECOMMENDED_IP_FEEDS) {
    const u = String(f.url || '').toLowerCase().trim();
    if (!u || existingUrls.has(u)) continue;
    try {
      await createFeed(
        {
          name: f.name,
          url: f.url,
          severity: f.severity || 'high',
          is_active: 1,
        },
        tenantId
      );
      created++;
      existingUrls.add(u);
    } catch {
      // ignore duplicates/validation issues
    }
  }
  return { ok: true, created, total: RECOMMENDED_IP_FEEDS.length };
}

async function updateFeed(id, patch, tenantId = null) {
  const feedId = parseInt(id, 10);
  if (!Number.isFinite(feedId)) throw new Error('Invalid feed id');

  const existing = await db.queryOne('SELECT * FROM xdr_ip_blacklist_feeds WHERE id = ?', [feedId]);
  if (!existing) throw new Error('Feed not found');
  if (tenantId != null && existing.tenant_id != null && existing.tenant_id !== tenantId) throw new Error('Forbidden');

  const next = {
    name: patch?.name != null ? String(patch.name).trim() : existing.name,
    url: patch?.url != null ? String(patch.url).trim() : existing.url,
    auth_header_name:
      patch?.auth_header_name !== undefined ? (patch.auth_header_name ? String(patch.auth_header_name).trim() : null) : existing.auth_header_name,
    auth_header_value:
      patch?.auth_header_value !== undefined ? (patch.auth_header_value ? String(patch.auth_header_value).trim() : null) : existing.auth_header_value,
    json_path: patch?.json_path !== undefined ? (patch.json_path ? String(patch.json_path).trim() : null) : existing.json_path,
    severity: patch?.severity != null ? String(patch.severity).toLowerCase().trim() : existing.severity,
    is_active:
      patch?.is_active !== undefined ? (patch.is_active === 0 || patch.is_active === false ? 0 : 1) : existing.is_active,
  };
  if (!next.name) throw new Error('name is required');
  if (!next.url) throw new Error('url is required');

  await db.execute(
    `UPDATE xdr_ip_blacklist_feeds
       SET name = ?, url = ?, auth_header_name = ?, auth_header_value = ?, json_path = ?, severity = ?, is_active = ?
     WHERE id = ?`,
    [
      next.name,
      next.url,
      next.auth_header_name,
      next.auth_header_value,
      next.json_path,
      next.severity,
      next.is_active,
      feedId,
    ]
  );
  return db.queryOne('SELECT * FROM xdr_ip_blacklist_feeds WHERE id = ?', [feedId]);
}

async function deleteFeed(id, tenantId = null) {
  const feedId = parseInt(id, 10);
  if (!Number.isFinite(feedId)) throw new Error('Invalid feed id');
  const existing = await db.queryOne('SELECT * FROM xdr_ip_blacklist_feeds WHERE id = ?', [feedId]);
  if (!existing) return false;
  if (tenantId != null && existing.tenant_id != null && existing.tenant_id !== tenantId) throw new Error('Forbidden');
  const r = await db.execute('DELETE FROM xdr_ip_blacklist_feeds WHERE id = ?', [feedId]);
  return r.affectedRows > 0;
}

async function syncFeedById(id, tenantId = null) {
  const feedId = parseInt(id, 10);
  if (!Number.isFinite(feedId)) throw new Error('Invalid feed id');
  const feed = await db.queryOne('SELECT * FROM xdr_ip_blacklist_feeds WHERE id = ?', [feedId]);
  if (!feed) throw new Error('Feed not found');
  if (tenantId != null && feed.tenant_id != null && feed.tenant_id !== tenantId) throw new Error('Forbidden');
  if (!feed.is_active) throw new Error('Feed is inactive');

  const headers = { 'User-Agent': 'OpenEDR-XDR/1.0 (ip-feed-sync)' };
  if (feed.auth_header_name && feed.auth_header_value) {
    headers[feed.auth_header_name] = feed.auth_header_value;
  }

  let ips = [];
  let lastError = null;
  try {
    const res = await fetch(feed.url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json();
      const node = feed.json_path ? extractByJsonPath(json, feed.json_path) : json;
      if (Array.isArray(node)) {
        ips = node.map((x) => String(x || '').trim()).filter(Boolean);
      } else if (typeof node === 'string') {
        ips = (node.match(IPV4_RE) || []).map((x) => x.trim());
      } else {
        ips = (JSON.stringify(node).match(IPV4_RE) || []).map((x) => x.trim());
      }
    } else {
      const body = await res.text();
      ips = (body.match(IPV4_RE) || []).map((x) => x.trim());
    }
    ips = uniq(ips).filter((ip) => ip && !ip.startsWith('127.') && ip !== '0.0.0.0');
  } catch (e) {
    lastError = e.message || String(e);
    logger.warn({ feedId, err: lastError }, 'XDR IP feed sync failed');
  }

  await db.execute(
    'UPDATE xdr_ip_blacklist_feeds SET last_sync_at = NOW(), last_error = ? WHERE id = ?',
    [lastError, feedId]
  );

  if (lastError) return { ok: false, imported: 0, error: lastError };

  let imported = 0;
  for (const ip of ips) {
    try {
      await addIoc('ip', ip, `3rd-party feed: ${feed.name}`, tenantId, feed.severity || 'high');
      imported++;
    } catch {
      // ignore duplicates/validation
    }
  }

  return { ok: true, imported, total: ips.length };
}

module.exports = {
  listFeeds,
  createFeed,
  bootstrapRecommendedFeeds,
  updateFeed,
  deleteFeed,
  syncFeedById,
};

