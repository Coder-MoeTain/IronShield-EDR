/**
 * Process / activity timeline from normalized_events (same-host chain view, lite)
 */
const db = require('../utils/db');

async function getTimeline(endpointId, query = {}, tenantId = null) {
  const hours = Math.min(parseInt(query.hours, 10) || 24, 168);
  const limit = Math.min(parseInt(query.limit, 10) || 300, 500);

  const buildSql = (useTenant) => {
    let sql = `
    SELECT ne.id, ne.timestamp, ne.event_type, ne.process_name, ne.process_id, ne.parent_process_name,
           ne.parent_process_id, ne.process_path, ne.command_line, ne.dns_query, ne.username, ne.hostname
    FROM normalized_events ne
    JOIN endpoints e ON e.id = ne.endpoint_id
    WHERE ne.endpoint_id = ?
      AND ne.timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
  `;
    const params = [endpointId, hours];
    if (useTenant && tenantId != null) {
      sql += ' AND e.tenant_id = ?';
      params.push(tenantId);
    }
    if (query.processId) {
      sql += ' AND (ne.process_id = ? OR ne.parent_process_id = ?)';
      const pid = parseInt(query.processId, 10);
      params.push(pid, pid);
    }
    sql += ' ORDER BY ne.timestamp ASC LIMIT ?';
    params.push(limit);
    return { sql, params };
  };

  try {
    const { sql, params } = buildSql(true);
    return await db.query(sql, params);
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' && tenantId != null) {
      const { sql, params } = buildSql(false);
      return db.query(sql, params);
    }
    throw err;
  }
}

module.exports = { getTimeline };
