/**
 * Network activity service - connections, traffic, logs
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

/** Common loopback remotes (IPv4/IPv6) to optionally hide from Network views */
const LOCALHOST_REMOTE_IPS = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];

function excludeLocalhostEnabled(filters) {
  const v = filters.excludeLocalhost;
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Appends AND (alias.col IS NULL OR alias.col NOT IN (...)) — caller must push ...LOCALHOST_REMOTE_IPS onto params */
function appendExcludeLocalhostRemote(sql, tableAlias, column = 'remote_address') {
  const placeholders = LOCALHOST_REMOTE_IPS.map(() => '?').join(', ');
  return `${sql} AND (${tableAlias}.${column} IS NULL OR ${tableAlias}.${column} NOT IN (${placeholders}))`;
}

/** For normalized_events: hide rows whose destination IP is loopback */
function appendExcludeLocalhostDestination(sql) {
  const placeholders = LOCALHOST_REMOTE_IPS.map(() => '?').join(', ');
  return `${sql} AND (ne.destination_ip IS NULL OR ne.destination_ip NOT IN (${placeholders}))`;
}

/** Returns [] on any query failure (missing table, SQL mode, etc.) so the API stays usable. */
async function safeQuery(sql, params = []) {
  try {
    return await db.query(sql, params);
  } catch (err) {
    logger.warn(
      { err: err.message, code: err.code, errno: err.errno },
      'NetworkService query failed'
    );
    return [];
  }
}

/** Merge latest endpoint_metrics (RX/TX Mbps from heartbeats) onto rows with endpoint_id. */
async function attachNetworkBandwidth(rows) {
  if (!rows || !rows.length) return rows;
  const ids = [...new Set(rows.map((r) => r.endpoint_id).filter((id) => id != null))];
  if (!ids.length) return rows;
  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    SELECT em.endpoint_id, em.network_rx_mbps, em.network_tx_mbps, em.collected_at
    FROM endpoint_metrics em
    INNER JOIN (
      SELECT endpoint_id, MAX(id) AS max_id
      FROM endpoint_metrics
      WHERE endpoint_id IN (${placeholders})
      GROUP BY endpoint_id
    ) latest ON latest.endpoint_id = em.endpoint_id AND latest.max_id = em.id
  `;
  const m = await safeQuery(sql, ids);
  const map = new Map(m.map((x) => [x.endpoint_id, x]));
  return rows.map((r) => {
    const b = map.get(r.endpoint_id);
    if (!b) return { ...r };
    return {
      ...r,
      network_rx_mbps: b.network_rx_mbps,
      network_tx_mbps: b.network_tx_mbps,
      metrics_collected_at: b.collected_at,
    };
  });
}

async function listConnections(filters = {}) {
  try {
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
  if (filters.hours) {
    sql += ' AND nc.last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    params.push(filters.hours);
  }
  if (excludeLocalhostEnabled(filters)) {
    sql = appendExcludeLocalhostRemote(sql, 'nc', 'remote_address');
    params.push(...LOCALHOST_REMOTE_IPS);
  }

  sql += ' ORDER BY nc.last_seen DESC';
  const limit = Math.min(parseInt(filters.limit) || 100, 500);
  const offset = parseInt(filters.offset) || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  let rows = await safeQuery(sql, params);
  rows = await attachNetworkBandwidth(rows);

  // Fallback: when network_connections is empty, derive from normalized_events
  if (rows.length === 0 && filters.endpointId) {
    const events = await getNetworkEventsFromNormalized({
      ...filters,
      limit: limit + offset,
    });
    const evList = Array.isArray(events) ? events : [];
    rows = evList.map((ne) => ({
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
    rows = await attachNetworkBandwidth(rows);
  }

  return rows;
  } catch (err) {
    logger.warn({ err: err.message }, 'NetworkService.listConnections');
    return [];
  }
}

async function getOutgoingIps(filters = {}) {
  try {
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
  if (excludeLocalhostEnabled(filters)) {
    sql = appendExcludeLocalhostRemote(sql, 'nc', 'remote_address');
    params.push(...LOCALHOST_REMOTE_IPS);
  }

  sql += ' GROUP BY nc.remote_address, nc.remote_port, nc.protocol, nc.endpoint_id, e.hostname, nc.process_name ORDER BY last_seen DESC LIMIT 200';
  const out = await safeQuery(sql, params);
  return attachNetworkBandwidth(out);
  } catch (err) {
    logger.warn({ err: err.message }, 'NetworkService.getOutgoingIps');
    return [];
  }
}

async function getTrafficSummary(filters = {}) {
  try {
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
  if (excludeLocalhostEnabled(filters)) {
    sql = appendExcludeLocalhostRemote(sql, 'nc', 'remote_address');
    params.push(...LOCALHOST_REMOTE_IPS);
  }

  sql += ' GROUP BY e.id, e.hostname ORDER BY total_connections DESC';
  const out = await safeQuery(sql, params);
  return attachNetworkBandwidth(out);
  } catch (err) {
    logger.warn({ err: err.message }, 'NetworkService.getTrafficSummary');
    return [];
  }
}

/**
 * Falcon-style KPI strip — aggregates for selected time window.
 */
async function getNetworkKpi(filters = {}) {
  try {
    let sql = `
      SELECT
        COUNT(*) AS total_connections,
        COUNT(DISTINCT nc.remote_address) AS unique_remote_ips,
        COUNT(DISTINCT nc.endpoint_id) AS hosts_with_activity
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
    if (excludeLocalhostEnabled(filters)) {
      sql = appendExcludeLocalhostRemote(sql, 'nc', 'remote_address');
      params.push(...LOCALHOST_REMOTE_IPS);
    }
    const rows = await safeQuery(sql, params);
    const row = rows[0] || {};
    const n = (v) => (v == null ? 0 : typeof v === 'bigint' ? Number(v) : Number(v));

    let outgoing_destinations = 0;
    try {
      let sql2 = `
        SELECT COUNT(*) AS c FROM (
          SELECT nc.remote_address, nc.remote_port, nc.protocol, nc.endpoint_id
          FROM network_connections nc
          JOIN endpoints e ON e.id = nc.endpoint_id
          WHERE nc.remote_address IS NOT NULL AND nc.remote_address != ''
      `;
      const p2 = [];
      if (filters.tenantId != null) {
        sql2 += ' AND e.tenant_id = ?';
        p2.push(filters.tenantId);
      }
      if (filters.endpointId) {
        sql2 += ' AND nc.endpoint_id = ?';
        p2.push(filters.endpointId);
      }
      if (filters.hours) {
        sql2 += ' AND nc.last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
        p2.push(filters.hours);
      }
      if (excludeLocalhostEnabled(filters)) {
        sql2 = appendExcludeLocalhostRemote(sql2, 'nc', 'remote_address');
        p2.push(...LOCALHOST_REMOTE_IPS);
      }
      sql2 += ' GROUP BY nc.remote_address, nc.remote_port, nc.protocol, nc.endpoint_id) t';
      const r2 = await safeQuery(sql2, p2);
      outgoing_destinations = n(r2[0]?.c);
    } catch (_) {
      outgoing_destinations = 0;
    }

    return {
      total_connections: n(row.total_connections),
      unique_remote_ips: n(row.unique_remote_ips),
      hosts_with_activity: n(row.hosts_with_activity),
      outgoing_destinations: outgoing_destinations || n(row.unique_remote_ips),
    };
  } catch (err) {
    logger.warn({ err: err.message }, 'NetworkService.getNetworkKpi');
    return {
      total_connections: 0,
      unique_remote_ips: 0,
      hosts_with_activity: 0,
      outgoing_destinations: 0,
    };
  }
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
  if (filters.hours) {
    sql += ' AND ne.timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    params.push(filters.hours);
  }
  if (excludeLocalhostEnabled(filters)) {
    sql = appendExcludeLocalhostDestination(sql);
    params.push(...LOCALHOST_REMOTE_IPS);
  }

  sql += ' ORDER BY ne.timestamp DESC LIMIT ?';
  params.push(Math.min(parseInt(filters.limit) || 50, 200));

  const ev = await safeQuery(sql, params);
  return attachNetworkBandwidth(ev);
}

function toNull(v) {
  return v === undefined ? null : v;
}

/** Ports treated as web (HTTP/HTTPS) traffic for dashboard map */
const HTTP_MAP_PORTS = [80, 443, 8080, 8443, 8000, 8888, 9443];

/**
 * Aggregated agent→remote edges for HTTP(S) connections (Activity dashboard map).
 * @param {number|null} tenantId
 * @param {number} hours 1–168
 * @returns {Promise<Array<{ endpoint_id: number, remote_address: string, hostname: string, w: number }>>}
 */
async function getHttpMapAggregates(tenantId, hours = 24) {
  try {
    const h = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 168);
    const portPh = HTTP_MAP_PORTS.map(() => '?').join(', ');
    let sql = `
      SELECT nc.endpoint_id, nc.remote_address, MAX(e.hostname) AS hostname, COUNT(*) AS w
      FROM network_connections nc
      JOIN endpoints e ON e.id = nc.endpoint_id
      WHERE nc.remote_address IS NOT NULL AND nc.remote_address != '' AND nc.remote_address != '0.0.0.0'
      AND nc.last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      AND nc.remote_port IN (${portPh})
    `;
    const params = [h, ...HTTP_MAP_PORTS];
    if (tenantId != null) {
      sql += ' AND e.tenant_id = ?';
      params.push(tenantId);
    }
    sql += ' GROUP BY nc.endpoint_id, nc.remote_address ORDER BY w DESC LIMIT 800';
    const rows = await safeQuery(sql, params);
    return (rows || []).map((r) => ({
      endpoint_id: r.endpoint_id,
      remote_address: r.remote_address,
      hostname: r.hostname,
      w: Math.max(1, Number(r.w) || 1),
    }));
  } catch (err) {
    logger.warn({ err: err.message }, 'NetworkService.getHttpMapAggregates');
    return [];
  }
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
  getNetworkKpi,
  getNetworkEventsFromNormalized,
  getHttpMapAggregates,
  upsertConnection,
};
