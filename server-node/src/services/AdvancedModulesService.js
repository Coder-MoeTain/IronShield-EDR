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
  const totalEndpoints = await safeQuery(`SELECT COUNT(*) AS c FROM endpoints e WHERE 1=1 ${t.sql}`, t.params);
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
  const privilegedConsoleUsers = await safeQuery(
    `SELECT TRIM(e.logged_in_user) AS username, COUNT(*) AS host_count
     FROM endpoints e
     WHERE e.logged_in_user IS NOT NULL
       AND TRIM(COALESCE(e.logged_in_user,'')) != ''
       AND (
         LOWER(TRIM(e.logged_in_user)) LIKE '%admin%'
         OR LOWER(TRIM(e.logged_in_user)) LIKE '%root%'
         OR LOWER(TRIM(e.logged_in_user)) LIKE '%svc%'
         OR LOWER(TRIM(e.logged_in_user)) LIKE '%service%'
       ) ${t.sql}
     GROUP BY TRIM(e.logged_in_user)
     ORDER BY host_count DESC
     LIMIT 25`,
    t.params
  );
  const spreadAccounts = await safeQuery(
    `SELECT TRIM(e.logged_in_user) AS username, COUNT(*) AS host_count
     FROM endpoints e
     WHERE e.logged_in_user IS NOT NULL AND TRIM(COALESCE(e.logged_in_user,'')) != '' ${t.sql}
     GROUP BY TRIM(e.logged_in_user)
     HAVING COUNT(*) >= 3
     ORDER BY host_count DESC
     LIMIT 25`,
    t.params
  );
  let eventUsers = [];
  let privilegedEventUsers = [];
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
    privilegedEventUsers = await safeQuery(
      `SELECT ne.username AS username, COUNT(*) AS event_count
       FROM normalized_events ne
       INNER JOIN endpoints e ON e.id = ne.endpoint_id AND e.tenant_id = ?
       WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND ne.username IS NOT NULL AND TRIM(ne.username) != ''
         AND (
           LOWER(TRIM(ne.username)) LIKE '%admin%'
           OR LOWER(TRIM(ne.username)) LIKE '%root%'
           OR LOWER(TRIM(ne.username)) LIKE '%svc%'
           OR LOWER(TRIM(ne.username)) LIKE '%service%'
         )
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
    privilegedEventUsers = await safeQuery(
      `SELECT ne.username AS username, COUNT(*) AS event_count
       FROM normalized_events ne
       WHERE ne.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND ne.username IS NOT NULL AND TRIM(ne.username) != ''
         AND (
           LOWER(TRIM(ne.username)) LIKE '%admin%'
           OR LOWER(TRIM(ne.username)) LIKE '%root%'
           OR LOWER(TRIM(ne.username)) LIKE '%svc%'
           OR LOWER(TRIM(ne.username)) LIKE '%service%'
         )
       GROUP BY ne.username
       ORDER BY event_count DESC
       LIMIT 25`,
      []
    );
  }
  const endpointsTotal = Number(totalEndpoints[0]?.c || 0);
  const endpointsWithUser = Number(withUser[0]?.c || 0);
  const identityCoveragePct = endpointsTotal > 0 ? Math.round((endpointsWithUser / endpointsTotal) * 100) : 0;
  const spreadAccountCount = Number(spreadAccounts.length || 0);
  const privilegedConsoleCount = Number(privilegedConsoleUsers.length || 0);
  const privilegedEventCount = Number(privilegedEventUsers.length || 0);
  const postureScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        identityCoveragePct * 0.7 +
          Math.max(0, 100 - spreadAccountCount * 6) * 0.15 +
          Math.max(0, 100 - (privilegedConsoleCount + privilegedEventCount) * 4) * 0.15
      )
    )
  );

  let postureBand = 'strong';
  if (postureScore < 50) postureBand = 'weak';
  else if (postureScore < 75) postureBand = 'moderate';
  return {
    endpoints_total: endpointsTotal,
    endpoints_with_logged_in_user: endpointsWithUser,
    identity_coverage_pct: identityCoveragePct,
    posture_score: postureScore,
    posture_band: postureBand,
    spread_accounts_3plus_hosts: spreadAccountCount,
    privileged_console_accounts: privilegedConsoleCount,
    privileged_event_accounts_7d: privilegedEventCount,
    hosts_by_console_user: byUser,
    top_usernames_in_events_7d: eventUsers,
    spread_accounts: spreadAccounts,
    privileged_console_accounts_list: privilegedConsoleUsers,
    privileged_event_accounts_list_7d: privilegedEventUsers,
  };
}

async function exposureSurface(tenantId) {
  const t = epTenant(tenantId);
  const ph = LOCALHOST.map(() => '?').join(', ');
  const paramsConn = [...LOCALHOST, ...t.params];
  const totalEndpoints = await safeQuery(`SELECT COUNT(*) AS c FROM endpoints e WHERE 1=1 ${t.sql}`, t.params);
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
  const uniqueRemoteIps = await safeQuery(
    `SELECT COUNT(DISTINCT nc.remote_address) AS c
     FROM network_connections nc
     INNER JOIN endpoints e ON e.id = nc.endpoint_id
     WHERE nc.remote_address IS NOT NULL AND nc.remote_address NOT IN (${ph}) ${t.sql}`,
    paramsConn
  );
  const highRiskPorts = await safeQuery(
    `SELECT nc.remote_port, COUNT(*) AS seen, COUNT(DISTINCT nc.endpoint_id) AS endpoint_count
     FROM network_connections nc
     INNER JOIN endpoints e ON e.id = nc.endpoint_id
     WHERE nc.remote_port IN (22, 23, 3389, 445, 5900, 1433, 3306, 5432)
       AND nc.remote_address IS NOT NULL AND nc.remote_address NOT IN (${ph}) ${t.sql}
     GROUP BY nc.remote_port
     ORDER BY seen DESC`,
    paramsConn
  );
  const newDestinations24h = await safeQuery(
    `SELECT nc.remote_address, nc.remote_port, MIN(nc.first_seen) AS first_seen, COUNT(*) AS seen
     FROM network_connections nc
     INNER JOIN endpoints e ON e.id = nc.endpoint_id
     WHERE nc.remote_address IS NOT NULL
       AND nc.remote_address NOT IN (${ph})
       AND nc.first_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR) ${t.sql}
     GROUP BY nc.remote_address, nc.remote_port
     ORDER BY first_seen DESC
     LIMIT 30`,
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
  const endpointsTotal = Number(totalEndpoints[0]?.c || 0);
  const uniqueIps = Number(uniqueRemoteIps[0]?.c || 0);
  const totalConnRows = Number(totalRows[0]?.c || 0);
  const riskyPortHits = Number(highRiskPorts.reduce((acc, row) => acc + Number(row.seen || 0), 0));
  const exposureScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          Math.min(55, uniqueIps * 0.5) -
          Math.min(30, riskyPortHits * 0.2) -
          Math.min(15, Number(newDestinations24h.length || 0) * 0.8)
      )
    )
  );
  let exposureBand = 'strong';
  if (exposureScore < 50) exposureBand = 'weak';
  else if (exposureScore < 75) exposureBand = 'moderate';
  return {
    endpoints_total: endpointsTotal,
    network_connection_rows: totalConnRows,
    unique_remote_ips: uniqueIps,
    high_risk_port_hits: riskyPortHits,
    new_destinations_24h: Number(newDestinations24h.length || 0),
    exposure_score: exposureScore,
    exposure_band: exposureBand,
    top_remote_endpoints: topRemotes,
    top_destination_ips_from_events_7d: fromEvents,
    high_risk_ports: highRiskPorts,
    new_destinations_last_24h: newDestinations24h,
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
  const tWhere = tenantId != null ? 'WHERE (tenant_id = ? OR tenant_id IS NULL)' : '';
  const tParams = tenantId != null ? [tenantId] : [];
  const xdr24 = await safeQuery(
    `SELECT COUNT(*) AS c FROM xdr_events
     WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ${tenantId != null ? 'AND (tenant_id = ? OR tenant_id IS NULL)' : ''}`,
    tParams
  );
  const det24 = await safeQuery(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical,
       SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high
     FROM xdr_detections
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ${tenantId != null ? 'AND (tenant_id = ? OR tenant_id IS NULL)' : ''}`,
    tParams
  );
  const incidentOpen = await safeQuery(
    `SELECT COUNT(*) AS c
     FROM incidents
     WHERE status IN ('open','investigating')
     ${tenantId != null ? 'AND (tenant_id = ? OR tenant_id IS NULL)' : ''}`,
    tParams
  );
  const triagePending = await safeQuery(
    `SELECT COUNT(*) AS c
     FROM triage_requests tr
     JOIN endpoints e ON e.id = tr.endpoint_id
     WHERE tr.status IN ('pending','in_progress')
     ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [tenantId] : []
  );
  const topDetectionEndpoints = await safeQuery(
    `SELECT d.endpoint_id, e.hostname, COUNT(*) AS detections
     FROM xdr_detections d
     LEFT JOIN endpoints e ON e.id = d.endpoint_id
     WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ${tenantId != null ? 'AND (d.tenant_id = ? OR d.tenant_id IS NULL)' : ''}
     GROUP BY d.endpoint_id, e.hostname
     ORDER BY detections DESC
     LIMIT 10`,
    tParams
  );
  const avgHuntMatches = await safeQuery(
    `SELECT AVG(result_count) AS avg_matches
     FROM hunt_results
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    []
  );
  let tenantNote = null;
  if (tenantId != null) {
    tenantNote = 'Hunt queries are global; results include all tenants. Filter rows in Hunting using tenant context when running.';
  }
  const recommendations = [
    {
      id: 'ps-encoded',
      title: 'Encoded PowerShell across hosts',
      query_params: { process_name: 'powershell.exe', q: '-enc', limit: 150 },
    },
    {
      id: 'rare-parent',
      title: 'Rare parent-child execution',
      query_params: { event_type: 'process_create', q: 'rundll32', limit: 150 },
    },
    {
      id: 'dns-suspicious',
      title: 'Suspicious long DNS activity',
      query_params: { event_type: 'dns_query', q: '.', limit: 150 },
    },
  ];
  return {
    saved_hunt_count: hunts.length,
    saved_hunts: hunts.slice(0, 20),
    recent_runs: recentRuns,
    xdr_events_24h: Number(xdr24[0]?.c || 0),
    xdr_detections_24h: Number(det24[0]?.total || 0),
    xdr_critical_24h: Number(det24[0]?.critical || 0),
    xdr_high_24h: Number(det24[0]?.high || 0),
    incidents_open: Number(incidentOpen[0]?.c || 0),
    triage_pending: Number(triagePending[0]?.c || 0),
    avg_hunt_matches_7d: Math.round(Number(avgHuntMatches[0]?.avg_matches || 0)),
    top_detection_endpoints_24h: topDetectionEndpoints,
    recommendations,
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
