/**
 * Free community IPv4 threat feeds (no API key). Refreshed on a schedule.
 * Sources: abuse.ch Feodo Tracker, IPsum, Emerging Threats compromised-IPs list.
 * Use for evaluation or augmentation only; verify licensing for your environment.
 */
const logger = require('../utils/logger');
const config = require('../config');

const IPV4_RE =
  /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

const DEFAULT_FEEDS = [
  {
    id: 'feodo_abuse_ch',
    name: 'Feodo Tracker (abuse.ch)',
    url: 'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt',
  },
  {
    id: 'ipsum_l1',
    name: 'IPsum level 1',
    url: 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/1.txt',
  },
  {
    id: 'et_compromised',
    name: 'ET compromised IPs',
    url: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
  },
];

let ipToFeeds = new Map();
const stats = {
  lastRefreshAt: null,
  lastOkAt: null,
  lastError: null,
  totalIps: 0,
  perFeed: {},
  refreshInProgress: false,
};

function isNonPublicIp(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return true;
  const a = +m[1];
  const b = +m[2];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function getFeedCatalog() {
  return config.threatIntel?.feeds?.length ? config.threatIntel.feeds : DEFAULT_FEEDS;
}

async function fetchFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'OpenEDR-ThreatIntel/1.0 (security telemetry)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function refresh() {
  if (!config.threatIntel?.enabled) return;
  if (stats.refreshInProgress) return;
  stats.refreshInProgress = true;
  stats.lastRefreshAt = new Date().toISOString();
  stats.lastError = null;

  const feeds = getFeedCatalog();
  const newMap = new Map();
  const previousMap = ipToFeeds;
  const perFeed = {};
  let successCount = 0;

  try {
    for (const f of feeds) {
      if (!f?.url) continue;
      try {
        const body = await fetchFeed(f.url);
        let hits = 0;
        for (const line of body.split(/\r?\n/)) {
          const t = line.trim();
          if (!t || t.startsWith('#')) continue;
          const ips = t.match(IPV4_RE);
          if (!ips) continue;
          for (const ip of ips) {
            if (isNonPublicIp(ip)) continue;
            if (!newMap.has(ip)) newMap.set(ip, new Set());
            newMap.get(ip).add(f.id);
            hits++;
          }
        }
        perFeed[f.id] = { ok: true, hits, name: f.name || f.id };
        successCount++;
      } catch (e) {
        perFeed[f.id] = { ok: false, error: e.message, name: f.name || f.id };
        logger.warn({ feed: f.id, err: e.message }, 'Threat intel feed fetch failed');
      }
    }

    stats.perFeed = perFeed;

    if (successCount === 0) {
      stats.lastError =
        previousMap.size > 0 ? 'All feeds failed; keeping previous IP set' : 'All feeds failed; no IPs loaded';
      logger.warn({ err: stats.lastError }, 'Threat intel refresh');
    } else {
      ipToFeeds = newMap;
      stats.totalIps = ipToFeeds.size;
      stats.lastOkAt = new Date().toISOString();
      logger.info({ totalIps: stats.totalIps, successCount }, 'Threat intel feeds refreshed');
    }
  } catch (e) {
    stats.lastError = e.message;
    logger.error({ err: e.message }, 'Threat intel refresh failed');
  } finally {
    stats.refreshInProgress = false;
  }
}

/**
 * @param {string} ip
 * @returns {{ matched: true, feedIds: string[], feedNames: string[] } | null}
 */
function lookup(ip) {
  if (!config.threatIntel?.enabled) return null;
  if (!ip || typeof ip !== 'string') return null;
  const trimmed = ip.trim();
  if (isNonPublicIp(trimmed)) return null;
  const feeds = ipToFeeds.get(trimmed);
  if (!feeds || feeds.size === 0) return null;
  const feedIds = [...feeds];
  const catalog = getFeedCatalog();
  const feedNames = feedIds.map((id) => {
    const fd = catalog.find((x) => x.id === id);
    return fd ? fd.name : id;
  });
  return { matched: true, feedIds, feedNames };
}

function getStatus() {
  return {
    enabled: !!config.threatIntel?.enabled,
    lastRefreshAt: stats.lastRefreshAt,
    lastOkAt: stats.lastOkAt,
    lastError: stats.lastError,
    totalIps: stats.totalIps,
    perFeed: stats.perFeed,
    refreshInProgress: stats.refreshInProgress,
    refreshIntervalMs: config.threatIntel?.refreshIntervalMs,
  };
}

let intervalId = null;

function startScheduler() {
  if (!config.threatIntel?.enabled) {
    logger.info('Threat intel disabled (set THREAT_INTEL_ENABLED=true to enable free IP feeds)');
    return;
  }
  refresh().catch(() => {});
  const ms = config.threatIntel.refreshIntervalMs || 6 * 60 * 60 * 1000;
  intervalId = setInterval(() => refresh().catch(() => {}), ms);
  if (typeof intervalId.unref === 'function') intervalId.unref();
}

module.exports = {
  refresh,
  lookup,
  getStatus,
  startScheduler,
  DEFAULT_FEEDS,
};
