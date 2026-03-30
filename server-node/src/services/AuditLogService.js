/**
 * Audit log service
 */
const db = require('../utils/db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SiemPushService = require('./SiemPushService');
const config = require('../config');
const logger = require('../utils/logger');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function appendImmutableArchive(entry) {
  const p = config.audit?.archivePath;
  if (!p) return;
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const serialized = JSON.stringify(entry);
  const sig = config.audit?.archiveHmacKey
    ? crypto.createHmac('sha256', config.audit.archiveHmacKey).update(serialized).digest('hex')
    : null;
  const line = JSON.stringify({ ...entry, archive_hmac_sha256: sig }) + '\n';
  fs.appendFileSync(p, line, { encoding: 'utf8' });
}

/** When DB insert fails, append NDJSON for later replay / evidence (SOC). */
function appendAuditFailureSpill(payload, err) {
  const custom = config.audit?.failureLogPath;
  const p = custom || path.join(process.cwd(), 'artifacts', 'audit-failures.ndjson');
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        error: String(err?.message || err),
        action: payload?.action,
        userId: payload?.userId,
        username: payload?.username,
      }) + '\n';
    fs.appendFileSync(p, line, 'utf8');
  } catch {
    /* ignore */
  }
}

async function logPersist(payload) {
  const {
    userId,
    username,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress,
    userAgent,
  } = payload;

  const row = {
    user_id: userId || null,
    username: username ? String(username).substring(0, 128) : null,
    action: String(action).substring(0, 128),
    resource_type: resourceType ? String(resourceType).substring(0, 64) : null,
    resource_id: resourceId ? String(resourceId).substring(0, 64) : null,
    details: details ? JSON.stringify(details) : null,
    ip_address: ipAddress ? String(ipAddress).substring(0, 45) : null,
    user_agent: userAgent ? String(userAgent).substring(0, 512) : null,
  };

  let prevHash = null;
  try {
    const last = await db.queryOne('SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1');
    prevHash = last?.entry_hash || null;
    const material = JSON.stringify({ prevHash, ...row });
    const entryHash = sha256Hex(material);
    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent, prev_hash, entry_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.user_id,
        row.username,
        row.action,
        row.resource_type,
        row.resource_id,
        row.details,
        row.ip_address,
        row.user_agent,
        prevHash,
        entryHash,
      ]
    );
    try {
      await SiemPushService.emit('ironshield.audit', { audit: { ...row, prev_hash: prevHash, entry_hash: entryHash } });
    } catch {
      /* ignore */
    }
    try {
      appendImmutableArchive({
        ts: new Date().toISOString(),
        user_id: row.user_id,
        username: row.username,
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        details: row.details,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        prev_hash: prevHash,
        entry_hash: entryHash,
      });
    } catch {
      /* ignore */
    }
    return;
  } catch {
    /* fall back below */
  }

  await db.query(
    `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.user_id,
      row.username,
      row.action,
      row.resource_type,
      row.resource_id,
      row.details,
      row.ip_address,
      row.user_agent,
    ]
  );
  try {
    await SiemPushService.emit('ironshield.audit', { audit: row });
  } catch {
    /* ignore */
  }
  try {
    appendImmutableArchive({
      ts: new Date().toISOString(),
      user_id: row.user_id,
      username: row.username,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      details: row.details,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      prev_hash: null,
      entry_hash: null,
    });
  } catch {
    /* ignore */
  }
}

async function log(payload) {
  try {
    await logPersist(payload);
  } catch (err) {
    logger.warn({ err: err.message }, 'Audit log DB persistence failed');
    appendAuditFailureSpill(payload, err);
  }
}

async function list(filters = {}) {
  let where = 'WHERE 1=1';
  const params = [];

  if (filters.userId) {
    where += ' AND user_id = ?';
    params.push(filters.userId);
  }
  if (filters.action) {
    where += ' AND action LIKE ?';
    params.push(`%${filters.action}%`);
  }

  const limit = Math.min(Math.max(parseInt(String(filters.limit), 10) || 100, 1), 500);
  const offset = Math.max(parseInt(String(filters.offset), 10) || 0, 0);

  const countRows = await db.query(`SELECT COUNT(*) AS c FROM audit_logs ${where}`, params);
  const total = Number(countRows?.[0]?.c ?? 0);

  const sql = `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const rows = await db.query(sql, [...params, limit, offset]);

  return { rows, total };
}

module.exports = { log, list };
