/**
 * Replay protection for signed agent requests (DB-backed with memory fallback).
 */
const db = require('../utils/db');
const config = require('../config');
const logger = require('../utils/logger');

const memoryCache = new Map();
let tableChecked = false;
let tableAvailable = false;

async function ensureTable() {
  if (tableChecked) return tableAvailable;
  tableChecked = true;
  try {
    await db.queryOne('SELECT 1 FROM agent_nonces LIMIT 1');
    tableAvailable = true;
  } catch (err) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(String(err?.code || ''))) {
      tableAvailable = false;
      logger.warn('agent_nonces table missing; using in-memory nonce cache');
    } else {
      throw err;
    }
  }
  return tableAvailable;
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

async function reserve(endpointId, nonce, expiresAt) {
  const replayKey = `${endpointId}:${nonce}`;
  const expiresMs = expiresAt.getTime();

  if (config.agent?.nonceStore !== 'memory' && (await ensureTable())) {
    try {
      await db.execute(
        `INSERT INTO agent_nonces (endpoint_id, nonce, expires_at) VALUES (?, ?, ?)`,
        [endpointId, String(nonce).substring(0, 64), expiresAt]
      );
      return { ok: true, store: 'db' };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return { ok: false, reason: 'replay' };
      logger.warn({ err: err.message }, 'agent_nonces insert failed; memory fallback');
    }
  }

  return memoryReserve(replayKey, expiresMs)
    ? { ok: true, store: 'memory' }
    : { ok: false, reason: 'replay' };
}

async function purgeExpired() {
  if (!(await ensureTable())) return;
  try {
    await db.execute('DELETE FROM agent_nonces WHERE expires_at < NOW() LIMIT 5000');
  } catch {
    /* ignore */
  }
}

module.exports = { reserve, purgeExpired, ensureTable };
