/**
 * Durable replay protection for signed agent requests (Redis SET NX EX, MySQL agent_request_nonces).
 */
const db = require('../utils/db');
const config = require('../config');
const logger = require('../utils/logger');
const redisClient = require('../utils/redisClient');

const memoryCache = new Map();
let tableChecked = false;
let tableAvailable = false;
const NONCE_TABLE = 'agent_request_nonces';

async function ensureTable() {
  if (tableChecked) return tableAvailable;
  tableChecked = true;
  try {
    await db.queryOne(`SELECT 1 FROM ${NONCE_TABLE} LIMIT 1`);
    tableAvailable = true;
  } catch (err) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(String(err?.code || ''))) {
      try {
        await db.queryOne('SELECT 1 FROM agent_nonces LIMIT 1');
        tableAvailable = 'legacy';
      } catch {
        tableAvailable = false;
        logger.warn('agent_request_nonces table missing; using Redis/memory nonce cache');
      }
    } else {
      throw err;
    }
  }
  return tableAvailable;
}

function nonceTableName() {
  return tableAvailable === 'legacy' ? 'agent_nonces' : NONCE_TABLE;
}

function memoryReserve(replayKey, expiresAtMs) {
  const now = Date.now();
  for (const [k, exp] of memoryCache.entries()) {
    if (exp <= now) memoryCache.delete(k);
  }
  if (memoryCache.has(replayKey)) return false;
  memoryCache.set(replayKey, expiresAtMs);
  return true;
}

async function redisReserve(endpointId, nonce, ttlSec) {
  const redis = redisClient.getRedis();
  if (!redis) return null;
  try {
    if (redis.status !== 'ready') await redis.connect();
    const key = `agent:${endpointId}:nonce:${nonce}`;
    const result = await redis.set(key, '1', 'EX', Math.max(60, ttlSec), 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis nonce SET NX failed');
    return null;
  }
}

/**
 * Reserve a nonce for replay protection. Returns { ok, store?, reason? }.
 */
async function reserve(endpointId, nonce, expiresAt) {
  const replayKey = `${endpointId}:${nonce}`;
  const expiresMs = expiresAt.getTime();
  const ttlSec = Math.max(60, Math.ceil((expiresMs - Date.now()) / 1000) + 30);
  const storePref = config.agent?.nonceStore || 'mysql';

  if ((storePref === 'redis' || storePref === 'mysql') && redisClient.isConfigured()) {
    const redisOk = await redisReserve(endpointId, nonce, ttlSec);
    if (redisOk === true) return { ok: true, store: 'redis' };
    if (redisOk === false) return { ok: false, reason: 'replay' };
  }

  const tableState = await ensureTable();
  if (storePref !== 'memory' && tableState) {
    const table = nonceTableName();
    try {
      await db.execute(
        `INSERT INTO ${table} (endpoint_id, nonce, expires_at) VALUES (?, ?, ?)`,
        [endpointId, String(nonce).substring(0, 128), expiresAt]
      );
      return { ok: true, store: table === NONCE_TABLE ? 'mysql' : 'mysql_legacy' };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return { ok: false, reason: 'replay' };
      logger.warn({ err: err.message }, `${table} insert failed; memory fallback`);
    }
  }

  return memoryReserve(replayKey, expiresMs)
    ? { ok: true, store: 'memory' }
    : { ok: false, reason: 'replay' };
}

async function purgeExpired() {
  const tableState = await ensureTable();
  if (!tableState) return;
  const table = nonceTableName();
  try {
    await db.execute(`DELETE FROM ${table} WHERE expires_at < NOW() LIMIT 10000`);
  } catch {
    /* ignore */
  }
  if (tableState === 'legacy' || table === NONCE_TABLE) {
    try {
      const other = table === NONCE_TABLE ? 'agent_nonces' : NONCE_TABLE;
      await db.execute(`DELETE FROM ${other} WHERE expires_at < NOW() LIMIT 5000`);
    } catch {
      /* ignore */
    }
  }
}

module.exports = { reserve, purgeExpired, ensureTable, NONCE_TABLE };
