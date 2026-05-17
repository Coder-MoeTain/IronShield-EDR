/**
 * Data source health and coverage per tenant/endpoint.
 */
const db = require('../../utils/db');
const { loadRulesFromDisk } = require('./ruleLoader');

const DATA_SOURCES = [
  'process_creation',
  'process_termination',
  'network_connection',
  'file_event',
  'registry_event',
  'powershell_event',
  'windows_security_event',
  'defender_event',
  'dns_event',
  'authentication_event',
];

const EVENT_TYPE_TO_SOURCE = {
  process_start: 'process_creation',
  process_create: 'process_creation',
  process_end: 'process_termination',
  network_connection: 'network_connection',
  file_create: 'file_event',
  file_write: 'file_event',
  registry_set: 'registry_event',
  registry_create: 'registry_event',
  powershell: 'powershell_event',
  auth_failed: 'authentication_event',
  auth_success: 'authentication_event',
};

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_data_source_health (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tenant_id BIGINT UNSIGNED NULL,
      endpoint_id BIGINT UNSIGNED NOT NULL,
      data_source VARCHAR(64) NOT NULL,
      status ENUM('available','missing','stale','disabled','unsupported') NOT NULL DEFAULT 'missing',
      last_event_at DATETIME NULL,
      event_count_24h INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_ds_health (endpoint_id, data_source),
      KEY idx_ds_health_tenant (tenant_id, data_source)
    ) ENGINE=InnoDB
  `);
}

async function refreshFromEvents(tenantId = null) {
  await ensureTable();
  let sql = `
    SELECT ne.endpoint_id, e.tenant_id, ne.event_type, MAX(ne.timestamp) AS last_ts, COUNT(*) AS c
    FROM normalized_events ne
    JOIN endpoints e ON e.id = ne.endpoint_id
    WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`;
  const params = [];
  if (tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' GROUP BY ne.endpoint_id, ne.event_type';
  const rows = await db.query(sql, params).catch(() => []);

  const byEndpoint = new Map();
  for (const row of rows) {
    const ds = EVENT_TYPE_TO_SOURCE[row.event_type] || 'process_creation';
    if (!byEndpoint.has(row.endpoint_id)) byEndpoint.set(row.endpoint_id, {});
    const ep = byEndpoint.get(row.endpoint_id);
    if (!ep[ds] || new Date(row.last_ts) > new Date(ep[ds].last_ts)) {
      ep[ds] = { last_ts: row.last_ts, count: Number(row.c) || 0, tenant_id: row.tenant_id };
    } else {
      ep[ds].count += Number(row.c) || 0;
    }
  }

  for (const [endpointId, sources] of byEndpoint) {
    for (const [ds, info] of Object.entries(sources)) {
      await db.execute(
        `INSERT INTO detection_data_source_health (tenant_id, endpoint_id, data_source, status, last_event_at, event_count_24h)
         VALUES (?, ?, ?, 'available', ?, ?)
         ON DUPLICATE KEY UPDATE status = 'available', last_event_at = VALUES(last_event_at), event_count_24h = VALUES(event_count_24h)`,
        [info.tenant_id, endpointId, ds, info.last_ts, info.count]
      );
    }
  }
}

async function getCoverage(tenantId = null) {
  await refreshFromEvents(tenantId);
  const rules = loadRulesFromDisk();
  const requiredBySource = {};
  for (const r of rules) {
    for (const ds of r.data_sources || ['process_creation']) {
      if (!requiredBySource[ds]) requiredBySource[ds] = [];
      requiredBySource[ds].push(r.id);
    }
  }

  let sql = `
    SELECT data_source,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS endpoints_reporting,
      COUNT(*) AS endpoints_total
    FROM detection_data_source_health h`;
  const params = [];
  if (tenantId != null) {
    sql += ' WHERE h.tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' GROUP BY data_source';

  const health = await db.query(sql, params).catch(() => []);

  return {
    data_sources: DATA_SOURCES.map((ds) => {
      const h = health.find((x) => x.data_source === ds) || {};
      return {
        data_source: ds,
        endpoints_reporting: Number(h.endpoints_reporting) || 0,
        endpoints_total: Number(h.endpoints_total) || 0,
        rules_depending: requiredBySource[ds] || [],
        rule_count: (requiredBySource[ds] || []).length,
      };
    }),
  };
}

module.exports = { getCoverage, refreshFromEvents, DATA_SOURCES, ensureTable };
