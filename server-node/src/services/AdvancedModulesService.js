/**
 * Advanced / Falcon-class module summaries — real telemetry from IronShield DB (not third-party ASM/IdP).
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

const LOCALHOST = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '0.0.0.0'];

async function safeQuery(sql, params = []) {
  try {
    return await db.query(sql, params);
  } catch (err) {
    logger.warn({ err: err.message, code: err.code }, 'AdvancedModulesService query skipped');
    return [];
  }
}

function epTenant(tenantId) {
  if (tenantId == null) return { sql: '', params: [] };
  return { sql: ' AND e.tenant_id = ? ', params: [tenantId] };
}

async function identityPosture(tenantId) {
  const t = epTenant(tenantId);
  const withUser = await safeQuery(
    `SELECT COUNT(*) AS c FROM endpoints e WHERE e.logged_in_user IS NOT NULL AND TRIM(COALESCE(e.logged_in_user,'')) != '' ${t.sql}`,
    t.params
  );
  const byUser = await safeQuery(
    `SELECT TRIM(e.logged_in_user) AS username, COUNT(*) AS host_count
     FROM endpoints e
     WHERE e.logged_in_user IS NOT NULL AND TRIM(COALESCE(e.logged_in_user,'')) != '' ${t.sql}
     GROUP BY TRIM(e.logged_in_user)
     ORDER BY host_count DESC
     LIMIT 30`,
    t.params
  );
  let eventUsers = [];
  if (tenantId != null) {
    eventUsers = await safeQuery(
      `SELECT ne.username AS username, COUNT(*) AS event_count
       FROM normalized_events ne
       INNER JOIN endpoints e ON e.id = ne.endpoint_id AND e.tenant_id = ?
       WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND ne.username IS NOT NULL AND TRIM(ne.username) != ''
       GROUP BY ne.username
       ORDER BY event_count DESC
       LIMIT 25`,
      [tenantId]
    );
  } else {
    eventUsers = await safeQuery(
      `SELECT ne.username AS username, COUNT(*) AS event_count
       FROM normalized_events ne
       WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND ne.username IS NOT NULL AND TRIM(ne.username) != ''
       GROUP BY ne.username
       ORDER BY event_count DESC
       LIMIT 25`,
      []
    );
  }
  return {
    endpoints_with_logged_in_user: Number(withUser[0]?.c || 0),
    hosts_by_console_user: byUser,
    top_usernames_in_events_7d: eventUsers,
  };
}

async function exposureSurface(tenantId) {
  const t = epTenant(tenantId);
  const ph = LOCALHOST.map(() => '?').join(', ');
  const paramsConn = [...LOCALHOST, ...t.params];
  const topRemotes = await safeQuery(
    `SELECT nc.remote_address, nc.remote_port, COUNT(*) AS seen,
            COUNT(DISTINCT nc.endpoint_id) AS endpoint_count,
            MAX(nc.last_seen) AS last_seen
     FROM network_connections nc
     INNER JOIN endpoints e ON e.id = nc.endpoint_id
     WHERE nc.remote_address IS NOT NULL AND nc.remote_address NOT IN (${ph}) ${t.sql}
     GROUP BY nc.remote_address, nc.remote_port
     ORDER BY seen DESC
     LIMIT 40`,
    paramsConn
  );
  const totalRows = await safeQuery(
    `SELECT COUNT(*) AS c FROM network_connections nc
     INNER JOIN endpoints e ON e.id = nc.endpoint_id
     WHERE nc.remote_address IS NOT NULL AND nc.remote_address NOT IN (${ph}) ${t.sql}`,
    paramsConn
  );
  let fromEvents = [];
  if (tenantId != null) {
    fromEvents = await safeQuery(
      `SELECT ne.destination_ip AS remote_ip, COUNT(*) AS event_count
       FROM normalized_events ne
       INNER JOIN endpoints e ON e.id = ne.endpoint_id AND e.tenant_id = ?
       WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND ne.destination_ip IS NOT NULL
         AND ne.destination_ip NOT IN (${ph})
       GROUP BY ne.destination_ip
       ORDER BY event_count DESC
       LIMIT 25`,
      [tenantId, ...LOCALHOST]
    );
  } else {
    fromEvents = await safeQuery(
      `SELECT ne.destination_ip AS remote_ip, COUNT(*) AS event_count
       FROM normalized_events ne
       WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND ne.destination_ip IS NOT NULL
         AND ne.destination_ip NOT IN (${ph})
       GROUP BY ne.destination_ip
       ORDER BY event_count DESC
       LIMIT 25`,
      LOCALHOST
    );
  }
  return {
    network_connection_rows: Number(totalRows[0]?.c || 0),
    top_remote_endpoints: topRemotes,
    top_destination_ips_from_events_7d: fromEvents,
  };
}

async function managedHuntingOverview(tenantId) {
  const hunts = await safeQuery('SELECT id, name, created_at, created_by FROM hunt_queries ORDER BY created_at DESC LIMIT 50', []);
  const recentRuns = await safeQuery(
    `SELECT hr.id, hr.hunt_id, hr.result_count, hq.name AS hunt_name
     FROM hunt_results hr
     LEFT JOIN hunt_queries hq ON hq.id = hr.hunt_id
     ORDER BY hr.id DESC
     LIMIT 15`,
    []
  );
  let tenantNote = null;
  if (tenantId != null) {
    tenantNote = 'Hunt queries are global; results include all tenants. Filter rows in Hunting using tenant context when running.';
  }
  return {
    saved_hunt_count: hunts.length,
    saved_hunts: hunts.slice(0, 20),
    recent_runs: recentRuns,
    tenant_note: tenantNote,
  };
}

async function preventionPosture(tenantId) {
  const t = epTenant(tenantId);
  const totals = await safeQuery(
    `SELECT
       COUNT(*) AS endpoints_total,
       SUM(CASE WHEN e.host_isolation_active = 1 OR e.host_isolation_active = TRUE THEN 1 ELSE 0 END) AS contained
     FROM endpoints e WHERE 1=1 ${t.sql}`,
    t.params
  );
  const ngav = await safeQuery(
    `SELECT COALESCE(NULLIF(TRIM(avs.prevention_status), ''), 'unknown') AS status, COUNT(*) AS c
     FROM endpoints e
     LEFT JOIN av_update_status avs ON avs.endpoint_id = e.id
     WHERE 1=1 ${t.sql}
     GROUP BY COALESCE(NULLIF(TRIM(avs.prevention_status), ''), 'unknown')`,
    t.params
  );
  const realtime = await safeQuery(
    `SELECT
       SUM(CASE WHEN avs.realtime_enabled = 1 OR avs.realtime_enabled = TRUE THEN 1 ELSE 0 END) AS on_count,
       SUM(CASE WHEN avs.realtime_enabled = 0 OR avs.realtime_enabled = FALSE THEN 1 ELSE 0 END) AS off_count
     FROM endpoints e
     LEFT JOIN av_update_status avs ON avs.endpoint_id = e.id
     WHERE 1=1 ${t.sql}`,
    t.params
  );
  return {
    endpoints_total: Number(totals[0]?.endpoints_total || 0),
    network_containment_active: Number(totals[0]?.contained || 0),
    ngav_prevention_by_status: ngav,
    ngav_realtime_on: Number(realtime[0]?.on_count || 0),
    ngav_realtime_off: Number(realtime[0]?.off_count || 0),
  };
}

async function integrationsFabric(tenantId) {
  let channels = [];
  if (tenantId != null) {
    channels = await safeQuery(
      `SELECT id, type, name, is_active, created_at FROM notification_channels
       WHERE tenant_id = ? OR tenant_id IS NULL
       ORDER BY is_active DESC, type, name`,
      [tenantId]
    );
  } else {
    channels = await safeQuery(
      'SELECT id, type, name, is_active, created_at FROM notification_channels ORDER BY is_active DESC, type, name',
      []
    );
  }
  const byType = {};
  for (const ch of channels) {
    const k = ch.type || 'unknown';
    if (!byType[k]) byType[k] = { total: 0, active: 0 };
    byType[k].total += 1;
    if (ch.is_active) byType[k].active += 1;
  }
  return {
    notification_channels: channels,
    channels_by_type: byType,
    siem_export_path: '/api/admin/export/siem-alerts',
  };
}

async function getModule(area, tenantId) {
  switch (area) {
    case 'identity':
      return { area, title: 'Identity / Zero Trust', data: await identityPosture(tenantId) };
    case 'exposure':
      return { area, title: 'Exposure / attack surface', data: await exposureSurface(tenantId) };
    case 'managed-hunting':
      return {
        area,
        title: 'Managed hunting / Overwatch',
        data: await managedHuntingOverview(tenantId),
      };
    case 'prevention-deep':
      return {
        area,
        title: 'Deep prevention (exploit, device control, USB)',
        data: await preventionPosture(tenantId),
      };
    case 'integrations':
      return { area, title: 'Integrations / XDR fabric', data: await integrationsFabric(tenantId) };
    default:
      return null;
  }
}

module.exports = {
  getModule,
  identityPosture,
  exposureSurface,
  managedHuntingOverview,
  preventionPosture,
  integrationsFabric,
};
