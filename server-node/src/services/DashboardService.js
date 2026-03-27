/**
 * Dashboard aggregation service - comprehensive EDR overview
 */
const db = require('../utils/db');
const AlertService = require('./AlertService');
const NormalizedEventService = require('./NormalizedEventService');
const ProcessMonitorService = require('../modules/processMonitor/processMonitorService');

function isSchemaCompatError(err) {
  return err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR');
}

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
    AlertService.list({ limit: 25, offset: 0, tenantId }),
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
         LIMIT 15`
      ),
    ])
      .then(([countRow, recentRows]) => ({
        count: countRow,
        recent: recentRows || [],
      }))
      .catch((err) => {
        if (isSchemaCompatError(err)) {
          return { count: { total: 0, open: 0 }, recent: [] };
        }
        throw err;
      }),
    db.queryOne(
      `SELECT COUNT(*) as count FROM triage_requests WHERE status IN ('pending', 'in_progress')`
    ).catch((err) => {
      if (isSchemaCompatError(err)) return { count: 0 };
      throw err;
    }),
    NormalizedEventService.getSummary(),
    ProcessMonitorService.getSuspectSummary(),
  ]);

  const ep = endpointRow || {};
  const invData = investigationsCount || {};
  const invCount = invData.count || {};
  const recentInvestigations = invData.recent || [];

  // Time-series data for charts (last 24 hours, hourly buckets)
  const [eventsOverTime, alertsOverTime, extras] = await Promise.all([
    db.query(
      `SELECT DATE_FORMAT(timestamp, '%Y-%m-%d %H:00') as hour, COUNT(*) as count
       FROM normalized_events
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY hour
       ORDER BY hour ASC`
    ),
    db.query(
      `SELECT DATE_FORMAT(first_seen, '%Y-%m-%d %H:00') as hour, COUNT(*) as count
       FROM alerts
       WHERE first_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY hour
       ORDER BY hour ASC`
    ),
    fetchDashboardExtras(tenantId),
  ]);

  return {
    endpoints: {
      total: Number(ep.total) || 0,
      online: Number(ep.online) || 0,
      offline: Number(ep.offline) || 0,
    },
    eventsToday: Number(eventsTodayRow?.count) || 0,
    eventsTotal: eventSummary?.total || 0,
    eventTypes: eventSummary?.byType?.slice(0, 10) || [],
    eventSources: eventSummary?.bySource?.slice(0, 10) || [],
    alertSummary: alertSummary || {},
    recentAlerts: recentAlerts || [],
    investigations: {
      total: Number(invCount.total) || 0,
      open: Number(invCount.open) || 0,
    },
    recentInvestigations,
    triagePending: Number(triagePendingRow?.count) || 0,
    suspectCount24h: suspectSummary?.suspect_count_24h || 0,
    eventsOverTime: eventsOverTime || [],
    alertsOverTime: alertsOverTime || [],
    ...extras,
  };
}

/** SOC counts, alert disposition, incidents, host policy mix — best-effort if tables/columns differ */
async function fetchDashboardExtras(tenantId = null) {
  const empty = {
    responseActionsPending: 0,
    alertsByStatus: [],
    openIncidents: 0,
    endpointsByPolicy: [],
    auditEvents24h: 0,
  };

  const tenantEp = tenantId != null ? ' AND e.tenant_id = ? ' : '';
  const tenantParams = tenantId != null ? [tenantId] : [];

  try {
    const [pendingRow, alertStatusRows, policyRows, auditRow, incRow] = await Promise.all([
      db
        .queryOne(
          `SELECT COUNT(*) AS c FROM response_actions ra
           INNER JOIN endpoints e ON e.id = ra.endpoint_id
           WHERE ra.approval_status = 'pending' ${tenantEp}`,
          tenantParams
        )
        .catch(() => ({ c: 0 })),
      db
        .query(
          `SELECT a.status, COUNT(*) AS count FROM alerts a
           INNER JOIN endpoints e ON e.id = a.endpoint_id
           WHERE 1=1 ${tenantEp}
           GROUP BY a.status`,
          tenantParams
        )
        .catch(() => []),
      db
        .query(
          `SELECT COALESCE(e.policy_status, 'normal') AS policy_status, COUNT(*) AS count
           FROM endpoints e WHERE 1=1 ${tenantId != null ? 'AND e.tenant_id = ?' : ''}
           GROUP BY COALESCE(e.policy_status, 'normal')`,
          tenantId != null ? [tenantId] : []
        )
        .catch(() => []),
      db
        .queryOne(
          `SELECT COUNT(*) AS c FROM audit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        )
        .catch(() => ({ c: 0 })),
      tenantId != null
        ? db
            .queryOne(
              `SELECT COUNT(*) AS c FROM incidents i
               INNER JOIN endpoints e ON e.id = i.endpoint_id
               WHERE i.status IN ('open','investigating') AND e.tenant_id = ?`,
              [tenantId]
            )
            .catch(() => ({ c: 0 }))
        : db
            .queryOne(
              `SELECT COUNT(*) AS c FROM incidents WHERE status IN ('open','investigating')`
            )
            .catch(() => ({ c: 0 })),
    ]);

    return {
      responseActionsPending: Number(pendingRow?.c) || 0,
      alertsByStatus: (alertStatusRows || []).map((r) => ({
        status: r.status || 'unknown',
        count: Number(r.count) || 0,
      })),
      openIncidents: Number(incRow?.c) || 0,
      endpointsByPolicy: (policyRows || []).map((r) => ({
        policy: r.policy_status || 'normal',
        count: Number(r.count) || 0,
      })),
      auditEvents24h: Number(auditRow?.c) || 0,
    };
  } catch (err) {
    if (isSchemaCompatError(err)) return empty;
    throw err;
  }
}

module.exports = { getSummary };
