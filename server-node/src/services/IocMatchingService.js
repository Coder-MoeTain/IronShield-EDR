/**
 * IOC matching - checks events against watchlist during ingestion
 * Phase A: Hash matching
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

let _hashCache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 min
let _ipCache = null;
let _domainCache = null;
let _urlCache = null;

async function getHashIocs() {
  if (_hashCache && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return _hashCache;
  }
  const rows = await db.query(
    "SELECT id, ioc_value, severity FROM ioc_watchlist WHERE ioc_type = 'hash' AND is_active = 1"
  );
  _hashCache = (rows || []).map((r) => ({ id: r.id, value: (r.ioc_value || '').toLowerCase().trim(), severity: r.severity }));
  _cacheTime = Date.now();
  return _hashCache;
}

async function getIocsByType(type) {
  const now = Date.now();
  if (type === 'ip' && _ipCache && now - _cacheTime < CACHE_TTL_MS) return _ipCache;
  if (type === 'domain' && _domainCache && now - _cacheTime < CACHE_TTL_MS) return _domainCache;
  if (type === 'url' && _urlCache && now - _cacheTime < CACHE_TTL_MS) return _urlCache;

  const rows = await db.query(
    `SELECT id, ioc_value, severity FROM ioc_watchlist WHERE ioc_type = ? AND is_active = 1`,
    [type]
  );
  const out = (rows || []).map((r) => ({ id: r.id, value: String(r.ioc_value || '').toLowerCase().trim(), severity: r.severity }));
  if (type === 'ip') _ipCache = out;
  if (type === 'domain') _domainCache = out;
  if (type === 'url') _urlCache = out;
  _cacheTime = now;
  return out;
}

/**
 * Check normalized event against IOC watchlist, record matches
 * @param {Object} norm - normalized event
 * @param {number} normalizedEventId - id in normalized_events
 */
async function checkAndRecordMatches(norm, normalizedEventId) {
  if (!norm?.endpoint_id) return;

  const hashIocs = await getHashIocs();
  const eventHash = (norm.file_hash_sha256 || '').toLowerCase().trim();
  if (hashIocs.length > 0 && eventHash && eventHash.length >= 32) {
    for (const ioc of hashIocs) {
      if (ioc.value && eventHash === ioc.value) {
        try {
          await db.execute(
            'INSERT INTO ioc_matches (ioc_id, event_id, endpoint_id) VALUES (?, ?, ?)',
            [ioc.id, normalizedEventId, norm.endpoint_id]
          );
          logger.info({ iocId: ioc.id, eventId: normalizedEventId, endpointId: norm.endpoint_id }, 'IOC hash match');
        } catch (err) {
          if (err.code !== 'ER_DUP_ENTRY') logger.warn({ err: err.message }, 'IOC match insert failed');
        }
      }
    }
  }

  // IP IOC match
  const ipIocs = await getIocsByType('ip').catch(() => []);
  const dst = (norm.destination_ip || '').toLowerCase().trim();
  if (ipIocs.length > 0 && dst) {
    for (const ioc of ipIocs) {
      if (ioc.value && dst === ioc.value) {
        try {
          await db.execute(
            'INSERT INTO ioc_matches (ioc_id, event_id, endpoint_id) VALUES (?, ?, ?)',
            [ioc.id, normalizedEventId, norm.endpoint_id]
          );
          logger.info({ iocId: ioc.id, eventId: normalizedEventId, endpointId: norm.endpoint_id }, 'IOC IP match');
        } catch (err) {
          if (err.code !== 'ER_DUP_ENTRY') logger.warn({ err: err.message }, 'IOC match insert failed');
        }
      }
    }
  }

  // Domain IOC match via dns_query
  const domainIocs = await getIocsByType('domain').catch(() => []);
  const dq = (norm.dns_query || '').toLowerCase().trim();
  if (domainIocs.length > 0 && dq) {
    for (const ioc of domainIocs) {
      if (ioc.value && (dq === ioc.value || dq.endsWith('.' + ioc.value))) {
        try {
          await db.execute(
            'INSERT INTO ioc_matches (ioc_id, event_id, endpoint_id) VALUES (?, ?, ?)',
            [ioc.id, normalizedEventId, norm.endpoint_id]
          );
          logger.info({ iocId: ioc.id, eventId: normalizedEventId, endpointId: norm.endpoint_id }, 'IOC domain match');
        } catch (err) {
          if (err.code !== 'ER_DUP_ENTRY') logger.warn({ err: err.message }, 'IOC match insert failed');
        }
      }
    }
  }
}

function invalidateCache() {
  _hashCache = null;
  _ipCache = null;
  _domainCache = null;
  _urlCache = null;
}

/**
 * Add SHA256 hash to watchlist (e.g. from block_hash response action).
 */
async function addHashIoc(iocValue, description, tenantId = null) {
  const v = String(iocValue || '').toLowerCase().trim();
  if (v.length < 32) throw new Error('Invalid hash');
  try {
    await db.execute(
      'INSERT INTO ioc_watchlist (tenant_id, ioc_type, ioc_value, description, severity) VALUES (?, ?, ?, ?, ?)',
      [tenantId, 'hash', v, description || 'block_hash response action', 'high']
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' && err.message?.includes('tenant_id')) {
      await db.execute(
        'INSERT INTO ioc_watchlist (ioc_type, ioc_value, description, severity) VALUES (?, ?, ?, ?)',
        ['hash', v, description || 'block_hash response action', 'high']
      );
    } else throw err;
  }
  invalidateCache();
}

async function addIoc(iocType, iocValue, description, tenantId = null, severity = 'high') {
  const type = String(iocType || '').toLowerCase().trim();
  const v = String(iocValue || '').toLowerCase().trim();
  if (!['hash', 'ip', 'domain', 'url'].includes(type)) throw new Error('Invalid iocType');
  if (!v || v.length < 3) throw new Error('Invalid iocValue');
  try {
    await db.execute(
      'INSERT INTO ioc_watchlist (tenant_id, ioc_type, ioc_value, description, severity) VALUES (?, ?, ?, ?, ?)',
      [tenantId, type, v, description || 'xdr feed', severity]
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' && err.message?.includes('tenant_id')) {
      await db.execute(
        'INSERT INTO ioc_watchlist (ioc_type, ioc_value, description, severity) VALUES (?, ?, ?, ?)',
        [type, v, description || 'xdr feed', severity]
      );
    } else throw err;
  }
  invalidateCache();
}

module.exports = { checkAndRecordMatches, getHashIocs, invalidateCache, addHashIoc, addIoc, getIocsByType };
