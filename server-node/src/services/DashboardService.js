/**
 * Dashboard aggregation service - comprehensive EDR overview
 */
const db = require('../utils/db');
const AlertService = require('./AlertService');
const NormalizedEventService = require('./NormalizedEventService');
const ProcessMonitorService = require('../modules/processMonitor/processMonitorService');

async function getSummary(tenantId = null) {
  const epFilter = tenantId != null ? ' WHERE tenant_id = ?' : '';
  const epParams = tenantId != null ? [tenantId] : [];
  const [
    endpointRow,
    eventsTodayRow,
    alertSummary,
    recentAlerts,
    investigationsCount,
    triagePendingRow,
    eventSummary,
    suspectSummary,
  ] = await Promise.all([
    db.queryOne(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'online' AND (last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)) THEN 1 ELSE 0 END), 0) as online,
        COALESCE(SUM(CASE WHEN status = 'offline' OR last_heartbeat_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE) OR last_heartbeat_at IS NULL THEN 1 ELSE 0 END), 0) as offline
       FROM endpoints${epFilter}`,
      epParams
    ),
    db.queryOne(
      `SELECT COUNT(*) as count FROM raw_events WHERE DATE(created_at) = CURDATE()`
    ),
    AlertService.getSummary(tenantId),
    AlertService.list({ limit: 10, offset: 0, tenantId }),
    Promise.all([
      db.queryOne(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('open', 'investigating') THEN 1 ELSE 0 END) as open
         FROM investigation_cases`
      ),
      db.query(
        `SELECT c.id, c.case_id, c.title, c.status, c.updated_at, e.hostname
         FROM investigation_cases c
         LEFT JOIN endpoints e ON e.id = c.endpoint_id
         WHERE c.status IN ('open', 'investigating')
         ORDER BY c.updated_at DESC
         LIMIT 5`
      ),
    ]).then(([countRow, recentRows]) => ({
      count: countRow,
      recent: recentRows || [],
    })),
    db.queryOne(
      `SELECT COUNT(*) as count FROM triage_requests WHERE status IN ('pending', 'in_progress')`
    ),
    NormalizedEventService.getSummary(),
    ProcessMonitorService.getSuspectSummary(),
  ]);

  const ep = endpointRow || {};
  const invData = investigationsCount || {};
  const invCount = invData.count || {};
  const recentInvestigations = invData.recent || [];

  return {
    endpoints: {
      total: Number(ep.total) || 0,
      online: Number(ep.online) || 0,
      offline: Number(ep.offline) || 0,
    },
    eventsToday: Number(eventsTodayRow?.count) || 0,
    eventsTotal: eventSummary?.total || 0,
    eventTypes: eventSummary?.byType?.slice(0, 6) || [],
    alertSummary: alertSummary || {},
    recentAlerts: recentAlerts || [],
    investigations: {
      total: Number(invCount.total) || 0,
      open: Number(invCount.open) || 0,
    },
    recentInvestigations,
    triagePending: Number(triagePendingRow?.count) || 0,
    suspectCount24h: suspectSummary?.suspect_count_24h || 0,
  };
}

module.exports = { getSummary };
