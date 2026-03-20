/**
 * Normalized event query service
 */
const db = require('../utils/db');

async function list(filters = {}) {
  let sql = `
    SELECT ne.id, ne.endpoint_id, ne.hostname, ne.username, ne.timestamp, ne.event_source, ne.event_type,
           ne.process_name, ne.process_path, ne.process_id, ne.parent_process_name, ne.command_line,
           ne.created_at, e.hostname as endpoint_hostname
    FROM normalized_events ne
    JOIN endpoints e ON e.id = ne.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.endpointId) {
    sql += ' AND ne.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hostname) {
    sql += ' AND ne.hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.eventType) {
    sql += ' AND ne.event_type = ?';
    params.push(filters.eventType);
  }
  if (filters.eventSource) {
    sql += ' AND ne.event_source LIKE ?';
    params.push(`%${String(filters.eventSource)}%`);
  }
  if (filters.username) {
    sql += ' AND ne.username LIKE ?';
    params.push(`%${String(filters.username)}%`);
  }
  if (filters.processName) {
    sql += ' AND ne.process_name LIKE ?';
    params.push(`%${String(filters.processName)}%`);
  }
  if (filters.dateFrom) {
    sql += ' AND ne.timestamp >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND ne.timestamp <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY ne.timestamp DESC';
  const limit = Math.min(parseInt(filters.limit) || 50, 200);
  const offset = parseInt(filters.offset) || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne(
    `SELECT ne.*, e.hostname as endpoint_hostname
     FROM normalized_events ne
     JOIN endpoints e ON e.id = ne.endpoint_id
     WHERE ne.id = ?`,
    [id]
  );
}

async function count(filters = {}) {
  let sql = 'SELECT COUNT(*) as total FROM normalized_events ne WHERE 1=1';
  const params = [];

  if (filters.endpointId) {
    sql += ' AND ne.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hostname) {
    sql += ' AND ne.hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.eventType) {
    sql += ' AND ne.event_type = ?';
    params.push(filters.eventType);
  }
  if (filters.eventSource) {
    sql += ' AND ne.event_source LIKE ?';
    params.push(`%${String(filters.eventSource)}%`);
  }
  if (filters.username) {
    sql += ' AND ne.username LIKE ?';
    params.push(`%${String(filters.username)}%`);
  }
  if (filters.processName) {
    sql += ' AND ne.process_name LIKE ?';
    params.push(`%${String(filters.processName)}%`);
  }
  if (filters.dateFrom) {
    sql += ' AND ne.timestamp >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND ne.timestamp <= ?';
    params.push(filters.dateTo);
  }

  const row = await db.queryOne(sql, params);
  return row?.total || 0;
}

async function getSummary() {
  const totalRows = await db.query(
    'SELECT COUNT(*) as total FROM normalized_events'
  );
  const todayRows = await db.query(
    `SELECT COUNT(*) as count FROM normalized_events WHERE DATE(timestamp) = CURDATE()`
  );
  const totalRow = totalRows?.[0];
  const todayRow = todayRows?.[0];
  const byType = await db.query(
    `SELECT event_type as type, COUNT(*) as count
     FROM normalized_events
     WHERE event_type IS NOT NULL AND event_type != ''
     GROUP BY event_type
     ORDER BY count DESC
     LIMIT 10`
  );
  const bySource = await db.query(
    `SELECT event_source as source, COUNT(*) as count
     FROM normalized_events
     WHERE event_source IS NOT NULL AND event_source != ''
     GROUP BY event_source
     ORDER BY count DESC
     LIMIT 8`
  );
  return {
    total: totalRow?.total || 0,
    today: todayRow?.count || 0,
    byType: byType || [],
    bySource: bySource || [],
  };
}

async function getLinkedAlerts(normalizedEventId) {
  const event = await getById(normalizedEventId);
  if (!event?.raw_event_id) return [];
  const idStr = String(event.raw_event_id);
  const alerts = await db.query(
    `SELECT a.id, a.title, a.severity, a.status, a.first_seen
     FROM alerts a
     WHERE a.source_event_ids IS NOT NULL
       AND a.source_event_ids LIKE ?
     ORDER BY a.first_seen DESC
     LIMIT 20`,
    [`%${idStr}%`]
  );
  return Array.isArray(alerts) ? alerts : [];
}

module.exports = { list, getById, count, getSummary, getLinkedAlerts };
