/**
 * Sensor health — version spread, connectivity (CrowdStrike-style host management signals)
 */
const db = require('../utils/db');

async function queryHealth(tenantId) {
  const baseWhere = tenantId != null ? 'WHERE e.tenant_id = ?' : 'WHERE 1=1';
  const params = tenantId != null ? [tenantId] : [];

  const byStatus = await db.query(
    `SELECT e.status, COUNT(*) as count FROM endpoints e ${baseWhere} GROUP BY e.status ORDER BY count DESC`,
    params
  );

  const byVersion = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(e.agent_version), ''), 'unknown') as agent_version, COUNT(*) as count
     FROM endpoints e ${baseWhere}
     GROUP BY COALESCE(NULLIF(TRIM(e.agent_version), ''), 'unknown')
     ORDER BY count DESC`,
    params
  );

  const totalRow = await db.queryOne(
    `SELECT COUNT(*) as count FROM endpoints e ${baseWhere}`,
    params
  );

  const staleWhere =
    tenantId != null
      ? 'WHERE e.tenant_id = ? AND (e.last_heartbeat_at IS NULL OR e.last_heartbeat_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))'
      : 'WHERE (e.last_heartbeat_at IS NULL OR e.last_heartbeat_at < DATE_SUB(NOW(), INTERVAL 24 HOUR))';
  const staleParams = tenantId != null ? [tenantId] : [];
  const staleRow = await db.queryOne(`SELECT COUNT(*) as count FROM endpoints e ${staleWhere}`, staleParams);

  const offlineSql =
    tenantId != null ? 'WHERE e.tenant_id = ? AND e.status = ?' : 'WHERE e.status = ?';
  const offlineParams = tenantId != null ? [tenantId, 'offline'] : ['offline'];
  const offlineRow = await db.queryOne(`SELECT COUNT(*) as count FROM endpoints e ${offlineSql}`, offlineParams);

  let pending_sensor_update = 0;
  try {
    const pendingSql = `${baseWhere} AND e.agent_update_status = 'update_available'`;
    const pendingRow = await db.queryOne(`SELECT COUNT(*) as count FROM endpoints e ${pendingSql}`, params);
    pending_sensor_update = pendingRow?.count ?? 0;
  } catch (_) {
    /* column missing before migrate-phase6-agent-update-telemetry */
  }

  let ngav_prevention_degraded = 0;
  try {
    let avSql = `SELECT COUNT(*) as count FROM av_update_status avs
      INNER JOIN endpoints e ON e.id = avs.endpoint_id
      WHERE avs.prevention_status = 'degraded'`;
    const avParams = [];
    if (tenantId != null) {
      avSql += ' AND e.tenant_id = ?';
      avParams.push(tenantId);
    }
    const avRow = await db.queryOne(avSql, avParams);
    ngav_prevention_degraded = avRow?.count ?? 0;
  } catch (_) {
    /* av_update_status / Phase 7 columns */
  }

  /** Phase 9 — assigned policy id ≠ sensor-reported policy id (Falcon policy drift). */
  let policy_mismatch = 0;
  try {
    let pmSql = `SELECT COUNT(*) as count FROM endpoints e
      WHERE e.assigned_policy_id IS NOT NULL AND e.edr_policy_id IS NOT NULL
        AND e.assigned_policy_id <> e.edr_policy_id`;
    const pmParams = [];
    if (tenantId != null) {
      pmSql += ' AND e.tenant_id = ?';
      pmParams.push(tenantId);
    }
    const pmRow = await db.queryOne(pmSql, pmParams);
    policy_mismatch = pmRow?.count ?? 0;
  } catch (_) {
    /* assigned_policy_id / edr_policy_id columns */
  }

  return {
    total_endpoints: totalRow?.count ?? 0,
    stale_heartbeat_24h: staleRow?.count ?? 0,
    offline: offlineRow?.count ?? 0,
    pending_sensor_update,
    ngav_prevention_degraded,
    policy_mismatch,
    by_status: byStatus || [],
    by_agent_version: byVersion || [],
  };
}

async function getHealth(tenantId = null) {
  try {
    return await queryHealth(tenantId);
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' && tenantId != null) {
      return queryHealth(null);
    }
    throw err;
  }
}

module.exports = { getHealth };
