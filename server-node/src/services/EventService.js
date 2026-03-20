/**
 * Event query service for admin dashboard
 */
const db = require('../utils/db');

async function list(filters = {}) {
  let sql = `
    SELECT re.id, re.endpoint_id, re.event_id, re.hostname, re.event_source, re.event_type,
           re.timestamp, re.created_at, e.hostname as endpoint_hostname
    FROM raw_events re
    JOIN endpoints e ON e.id = re.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.endpointId) {
    sql += ' AND re.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hostname) {
    sql += ' AND re.hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.eventType) {
    sql += ' AND re.event_type = ?';
    params.push(filters.eventType);
  }
  if (filters.username) {
    sql += ' AND re.raw_event_json->>"$.username" LIKE ?';
    params.push(`%${String(filters.username)}%`);
  }
  if (filters.processName) {
    sql += ' AND (re.raw_event_json->>"$.process_name" LIKE ? OR re.raw_event_json->>"$.ProcessName" LIKE ?)';
    params.push(`%${String(filters.processName)}%`, `%${String(filters.processName)}%`);
  }
  if (filters.dateFrom) {
    sql += ' AND re.timestamp >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND re.timestamp <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY re.timestamp DESC';
  const limit = Math.min(parseInt(filters.limit) || 50, 200);
  const offset = parseInt(filters.offset) || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne(
    `SELECT re.*, e.hostname as endpoint_hostname
     FROM raw_events re
     JOIN endpoints e ON e.id = re.endpoint_id
     WHERE re.id = ?`,
    [id]
  );
}

async function count(filters = {}) {
  let sql = 'SELECT COUNT(*) as total FROM raw_events re WHERE 1=1';
  const params = [];

  if (filters.endpointId) {
    sql += ' AND re.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hostname) {
    sql += ' AND re.hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.eventType) {
    sql += ' AND re.event_type = ?';
    params.push(filters.eventType);
  }
  if (filters.dateFrom) {
    sql += ' AND re.timestamp >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND re.timestamp <= ?';
    params.push(filters.dateTo);
  }

  const row = await db.queryOne(sql, params);
  return row?.total || 0;
}

module.exports = { list, getById, count };
