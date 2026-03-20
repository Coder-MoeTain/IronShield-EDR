/**
 * Endpoint management service
 */
const db = require('../utils/db');

async function list(filters = {}) {
  let sql = `SELECT * FROM endpoints WHERE 1=1`;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.hostname) {
    sql += ' AND hostname LIKE ?';
    params.push(`%${String(filters.hostname)}%`);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY last_heartbeat_at DESC';
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Math.min(parseInt(filters.limit) || 100, 500));
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(parseInt(filters.offset) || 0);
  }

  return db.query(sql, params);
}

async function getById(id, tenantId = null) {
  let sql = `SELECT * FROM endpoints WHERE id = ?`;
  const params = [id];
  if (tenantId != null) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  const endpoint = await db.queryOne(sql, params);
  if (!endpoint) return null;

  // If endpoint has no CPU/RAM/Disk metrics, use latest from endpoint_metrics
  const hasMetrics = endpoint.cpu_percent != null || endpoint.ram_percent != null || endpoint.disk_percent != null;
  if (!hasMetrics) {
    try {
      const [latest] = await db.query(
        `SELECT cpu_percent, ram_percent, disk_percent FROM endpoint_metrics
         WHERE endpoint_id = ? ORDER BY collected_at DESC LIMIT 1`,
        [id]
      );
      if (latest?.[0]) {
        endpoint.cpu_percent = latest[0].cpu_percent;
        endpoint.ram_percent = latest[0].ram_percent;
        endpoint.disk_percent = latest[0].disk_percent;
      }
    } catch (_) {
      // endpoint_metrics table may not exist
    }
  }

  return endpoint;
}

async function getByAgentKey(agentKey) {
  return db.queryOne('SELECT * FROM endpoints WHERE agent_key = ?', [agentKey]);
}

async function getMetrics(endpointId, limit = 100) {
  return db.query(
    `SELECT cpu_percent, ram_percent, ram_total_mb, ram_used_mb, disk_percent, disk_total_gb, disk_used_gb,
            network_rx_mbps, network_tx_mbps, collected_at
     FROM endpoint_metrics
     WHERE endpoint_id = ?
     ORDER BY collected_at DESC
     LIMIT ?`,
    [endpointId, limit]
  );
}

async function deleteById(id, tenantId = null) {
  let sql = 'DELETE FROM endpoints WHERE id = ?';
  const params = [id];
  if (tenantId != null) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  const result = await db.execute(sql, params);
  return result.affectedRows > 0;
}

module.exports = { list, getById, getByAgentKey, getMetrics, deleteById };
