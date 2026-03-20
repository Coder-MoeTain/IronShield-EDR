/**
 * Network activity service - connections, traffic, logs
 */
const db = require('../utils/db');

async function listConnections(filters = {}) {
  let sql = `
    SELECT nc.*, e.hostname
    FROM network_connections nc
    JOIN endpoints e ON e.id = nc.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.endpointId) {
    sql += ' AND nc.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.remoteAddress) {
    sql += ' AND nc.remote_address LIKE ?';
    params.push(`%${String(filters.remoteAddress)}%`);
  }
  if (filters.remotePort) {
    sql += ' AND nc.remote_port = ?';
    params.push(filters.remotePort);
  }
  if (filters.processName) {
    sql += ' AND nc.process_name LIKE ?';
    params.push(`%${String(filters.processName)}%`);
  }
  if (filters.dateFrom) {
    sql += ' AND nc.last_seen >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND nc.last_seen <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY nc.last_seen DESC';
  const limit = Math.min(parseInt(filters.limit) || 100, 500);
  const offset = parseInt(filters.offset) || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  let rows = await db.query(sql, params);

  // Fallback: when network_connections is empty, derive from normalized_events
  if (rows.length === 0 && filters.endpointId) {
    const events = await getNetworkEventsFromNormalized({
      ...filters,
      limit: limit + offset,
    });
    rows = events.map((ne) => ({
      id: `ne-${ne.id}`,
      endpoint_id: ne.endpoint_id,
      hostname: ne.hostname || ne.endpoint_hostname,
      local_address: ne.source_ip,
      local_port: null,
      remote_address: ne.destination_ip,
      remote_port: ne.destination_port,
      protocol: ne.protocol || 'TCP',
      state: null,
      process_id: null,
      process_name: ne.process_name,
      process_path: ne.process_path,
      first_seen: ne.timestamp,
      last_seen: ne.timestamp,
    }));
    if (offset > 0) rows = rows.slice(offset);
    rows = rows.slice(0, limit);
  }

  return rows;
}

async function getOutgoingIps(filters = {}) {
  let sql = `
    SELECT nc.remote_address, nc.remote_port, nc.protocol,
           COUNT(*) as conn_count, MAX(nc.last_seen) as last_seen,
           nc.endpoint_id, e.hostname, nc.process_name
    FROM network_connections nc
    JOIN endpoints e ON e.id = nc.endpoint_id
    WHERE nc.remote_address IS NOT NULL AND nc.remote_address != '' AND nc.remote_address != '0.0.0.0'
  `;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.endpointId) {
    sql += ' AND nc.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hours) {
    sql += ' AND nc.last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    params.push(filters.hours);
  }

  sql += ' GROUP BY nc.remote_address, nc.remote_port, nc.protocol, nc.endpoint_id, e.hostname, nc.process_name ORDER BY last_seen DESC LIMIT 200';
  return db.query(sql, params);
}

async function getTrafficSummary(filters = {}) {
  let sql = `
    SELECT e.id as endpoint_id, e.hostname,
           COUNT(DISTINCT nc.remote_address) as unique_ips,
           COUNT(*) as total_connections,
           MAX(nc.last_seen) as last_activity
    FROM network_connections nc
    JOIN endpoints e ON e.id = nc.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.endpointId) {
    sql += ' AND nc.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.hours) {
    sql += ' AND nc.last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    params.push(filters.hours);
  }

  sql += ' GROUP BY e.id, e.hostname ORDER BY total_connections DESC';
  return db.query(sql, params);
}

async function getNetworkEventsFromNormalized(filters = {}) {
  let sql = `
    SELECT ne.id, ne.endpoint_id, ne.hostname, ne.timestamp, ne.event_source, ne.event_type,
           ne.source_ip, ne.destination_ip, ne.destination_port, ne.protocol,
           ne.process_name, ne.process_path, ne.command_line, e.hostname as endpoint_hostname
    FROM normalized_events ne
    JOIN endpoints e ON e.id = ne.endpoint_id
    WHERE (ne.destination_ip IS NOT NULL AND ne.destination_ip != '')
       OR (ne.source_ip IS NOT NULL AND ne.source_ip != '')
  `;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.endpointId) {
    sql += ' AND ne.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.dateFrom) {
    sql += ' AND ne.timestamp >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND ne.timestamp <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY ne.timestamp DESC LIMIT ?';
  params.push(Math.min(parseInt(filters.limit) || 50, 200));

  return db.query(sql, params);
}

function toNull(v) {
  return v === undefined ? null : v;
}

async function upsertConnection(endpointId, conn) {
  const local_address = toNull(conn.local_address);
  const local_port = toNull(conn.local_port);
  const remote_address = toNull(conn.remote_address) ?? '';
  const remote_port = toNull(conn.remote_port) ?? 0;
  const protocol = toNull(conn.protocol) ?? 'TCP';
  const state = toNull(conn.state);
  const process_id = toNull(conn.process_id);
  const process_name = toNull(conn.process_name);
  const process_path = toNull(conn.process_path);

  const existing = await db.queryOne(
    `SELECT id FROM network_connections 
     WHERE endpoint_id = ? AND remote_address = ? AND remote_port = ? AND COALESCE(local_address, '') = COALESCE(?, '') AND COALESCE(local_port, 0) = COALESCE(?, 0)
     LIMIT 1`,
    [endpointId, remote_address, remote_port, local_address, local_port]
  );
  if (existing) {
    await db.execute(
      'UPDATE network_connections SET last_seen = NOW(), state = COALESCE(?, state), process_name = COALESCE(?, process_name), process_path = COALESCE(?, process_path) WHERE id = ?',
      [state, process_name, process_path, existing.id]
    );
    return existing.id;
  }
  const result = await db.execute(
    `INSERT INTO network_connections (endpoint_id, local_address, local_port, remote_address, remote_port, protocol, state, process_id, process_name, process_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [endpointId, local_address, local_port, remote_address, remote_port, protocol, state, process_id, process_name, process_path]
  );
  return result.insertId;
}

module.exports = {
  listConnections,
  getOutgoingIps,
  getTrafficSummary,
  getNetworkEventsFromNormalized,
  upsertConnection,
};
