/**
 * Aggregates public cybersecurity RSS feeds for the Activity dashboard ticker.
 * Server-side only — avoids browser CORS and allows short caching.
 */

const CACHE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_PER_FEED = 15;
const MAX_TOTAL = 45;

/** Curated cyber-only sources (RSS 2.0). */
const FEEDS = [
  { url: 'https://www.bleepingcomputer.com/feed/', source: 'BleepingComputer' },
  { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'The Hacker News' },
  { url: 'https://krebsonsecurity.com/feed/', source: 'Krebs on Security' },
  { url: 'https://threatpost.com/feed/', source: 'Threatpost' },
];

let cache = { at: 0, items: [], warnings: [] };

function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripCdata(s) {
  const m = String(s).match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1].trim() : String(s).trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = re.exec(block);
  if (!m) return '';
  let inner = m[1].trim();
  inner = inner.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1').trim();
  return decodeEntities(inner.replace(/<[^>]+>/g, ''));
}

function extractItemLink(block) {
  const link = extractTag(block, 'link');
  if (link) return link;
  const guid = extractTag(block, 'guid');
  return guid || '';
}

function parseRssItems(xml, sourceLabel) {
  const items = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < MAX_PER_FEED) {
    const block = m[0];
    const title = extractTag(block, 'title');
    if (!title || title.length < 4) continue;
    const link = extractItemLink(block);
    const pubRaw = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || '';
    const publishedAt = pubRaw ? new Date(pubRaw).toISOString() : new Date(0).toISOString();
    items.push({
      title: stripCdata(title).slice(0, 500),
      link: link || '#',
      source: sourceLabel,
      publishedAt,
    });
  }
  return items;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'IronShield-Dashboard/1.0 (cyber-news aggregator)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

/**
 * @returns {{ items: Array, fetchedAt: string, warnings: string[] }}
 */
async function getCyberNews() {
  const now = Date.now();
  if (cache.at && now - cache.at < CACHE_MS && cache.items.length) {
    return {
      items: cache.items,
      fetchedAt: new Date(cache.at).toISOString(),
      warnings: cache.warnings,
    };
  }

  const all = [];
  const warnings = [];

  await Promise.all(
    FEEDS.map(async ({ url, source }) => {
      try {
        const xml = await fetchText(url);
        const parsed = parseRssItems(xml, source);
        all.push(...parsed);
      } catch (e) {
        warnings.push(`${source}: ${e.message || 'unavailable'}`);
      }
    })
  );

  const seen = new Set();
  const deduped = [];
  for (const it of all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))) {
    const key = it.link || it.title;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
    if (deduped.length >= MAX_TOTAL) break;
  }

  cache = { at: now, items: deduped, warnings };
  return {
    items: deduped,
    fetchedAt: new Date(now).toISOString(),
    warnings,
  };
}

module.exports = { getCyberNews, FEEDS };
