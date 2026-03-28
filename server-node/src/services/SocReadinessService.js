/**
 * Enterprise SOC posture snapshot — operational signals (not compliance certification).
 */
const db = require('../utils/db');
const QueueService = require('./QueueService');
const config = require('../config');

function isCompat(err) {
  return err?.code === 'ER_BAD_FIELD_ERROR' || err?.code === 'ER_NO_SUCH_TABLE';
}

/**
 * @param {number|null} tenantId
 */
async function getReadiness(tenantId = null) {
  const epWhere = tenantId != null ? ' WHERE tenant_id = ?' : '';
  const epParams = tenantId != null ? [tenantId] : [];

  const out = {
    generated_at: new Date().toISOString(),
    endpoints_total: 0,
    endpoints_online_15m: 0,
    alerts_open: 0,
    detection_rules_enabled: 0,
    ingest_async_queue: QueueService.isEnabled(),
    kafka_ingest: !!(config.kafka && config.kafka.enabled),
    tamper_high_hosts: 0,
    notes: [],
  };

  try {
    const ep = await db.queryOne(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END), 0) as online_15m
       FROM endpoints${epWhere}`,
      epParams
    );
    out.endpoints_total = Number(ep?.total) || 0;
    out.endpoints_online_15m = Number(ep?.online_15m) || 0;
  } catch (err) {
    if (!isCompat(err)) throw err;
    out.notes.push('endpoints summary skipped (schema)');
  }

  try {
    const alertWhere =
      tenantId != null
        ? `WHERE a.status IN ('new','investigating') AND e.tenant_id = ?`
        : `WHERE a.status IN ('new','investigating')`;
    const alertParams = tenantId != null ? [tenantId] : [];
    const row = await db.queryOne(
      `SELECT COUNT(*) as c FROM alerts a
       ${tenantId != null ? 'JOIN endpoints e ON e.id = a.endpoint_id' : ''}
       ${alertWhere}`,
      alertParams
    );
    out.alerts_open = Number(row?.c) || 0;
  } catch (err) {
    if (!isCompat(err)) throw err;
    out.notes.push('alerts_open skipped');
  }

  try {
    const ruleWhere = tenantId != null ? ' WHERE tenant_id = ? AND enabled = 1' : ' WHERE enabled = 1';
    const ruleParams = tenantId != null ? [tenantId] : [];
    const row = await db.queryOne(`SELECT COUNT(*) as c FROM detection_rules${ruleWhere}`, ruleParams);
    out.detection_rules_enabled = Number(row?.c) || 0;
  } catch (err) {
    try {
      const row = await db.queryOne('SELECT COUNT(*) as c FROM detection_rules WHERE enabled = 1');
      out.detection_rules_enabled = Number(row?.c) || 0;
    } catch (e2) {
      if (!isCompat(e2)) throw e2;
      out.notes.push('detection_rules count skipped');
    }
  }

  try {
    const sql =
      tenantId != null
        ? `SELECT COUNT(*) as c FROM endpoints e
           WHERE e.tenant_id = ?
             AND JSON_UNQUOTE(JSON_EXTRACT(e.tamper_signals_json, '$.tamper_risk')) = 'high'`
        : `SELECT COUNT(*) as c FROM endpoints
           WHERE JSON_UNQUOTE(JSON_EXTRACT(tamper_signals_json, '$.tamper_risk')) = 'high'`;
    const thParams = tenantId != null ? [tenantId] : [];
    const row = await db.queryOne(sql, thParams);
    out.tamper_high_hosts = Number(row?.c) || 0;
  } catch (err) {
    out.tamper_high_hosts = null;
    out.notes.push('tamper_high_hosts unavailable (migrate-tamper-signals or JSON support)');
  }

  if (!out.ingest_async_queue) {
    out.notes.push('REDIS_URL not set — ingest runs synchronously (fine for small fleets)');
  }

  return out;
}

module.exports = { getReadiness };
