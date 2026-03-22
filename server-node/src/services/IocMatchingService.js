/**
 * IOC matching - checks events against watchlist during ingestion
 * Phase A: Hash matching
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

let _hashCache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60000; // 1 min

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

/**
 * Check normalized event against IOC watchlist, record matches
 * @param {Object} norm - normalized event
 * @param {number} normalizedEventId - id in normalized_events
 */
async function checkAndRecordMatches(norm, normalizedEventId) {
  if (!norm?.endpoint_id) return;

  const hashIocs = await getHashIocs();
  if (hashIocs.length === 0) return;

  const eventHash = (norm.file_hash_sha256 || '').toLowerCase().trim();
  if (!eventHash || eventHash.length < 32) return;

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

function invalidateCache() {
  _hashCache = null;
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

module.exports = { checkAndRecordMatches, getHashIocs, invalidateCache, addHashIoc };
