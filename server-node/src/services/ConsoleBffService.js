/**
 * BFF aggregations for compact 8-page console modules.
 */
const DashboardService = require('./DashboardService');
const AlertService = require('./AlertService');
const db = require('../utils/db');

async function getOverview(tenantId = null) {
  const summary = await DashboardService.getSummary(tenantId);
  const ep = summary.endpoints || {};
  const alerts = summary.alerts || {};
  return {
    kpis: {
      endpoints: { total: ep.total ?? 0, online: ep.online ?? 0, offline: ep.offline ?? 0 },
      alerts: {
        critical: alerts.critical ?? alerts.bySeverity?.critical ?? 0,
        high: alerts.high ?? alerts.bySeverity?.high ?? 0,
      },
      incidents: { open: summary.investigations?.open ?? 0 },
      ingestion: { eventsToday: summary.eventsToday ?? 0 },
    },
    summary,
  };
}

async function getEndpoints(tenantId = null) {
  const epFilter = tenantId != null ? ' WHERE tenant_id = ?' : '';
  const epParams = tenantId != null ? [tenantId] : [];
  const row = await db.queryOne(
    `SELECT COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END), 0) as online
     FROM endpoints${epFilter}`,
    epParams
  );
  return { endpoints: row || { total: 0, online: 0 } };
}

async function getEndpointDetail(endpointId, tenantId = null) {
  const params = [endpointId];
  let sql = 'SELECT * FROM endpoints WHERE id = ?';
  if (tenantId != null) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  const endpoint = await db.queryOne(sql, params);
  return { endpoint };
}

async function getDetections(tenantId = null) {
  const [alertSummary, triage] = await Promise.all([
    AlertService.getSummary(tenantId),
    db.queryOne(
      `SELECT COUNT(*) as pending FROM triage_queue_items WHERE status IN ('open','pending')`
    ).catch(() => ({ pending: 0 })),
  ]);
  return { alerts: alertSummary, triage: triage || { pending: 0 } };
}

async function getInvestigation() {
  const row = await db
    .queryOne(
      `SELECT COUNT(*) as total,
        SUM(CASE WHEN status IN ('open','investigating','triage') THEN 1 ELSE 0 END) as open
       FROM incidents`
    )
    .catch(() => ({ total: 0, open: 0 }));
  return { incidents: row || { total: 0, open: 0 } };
}

async function getResponse() {
  const row = await db
    .queryOne(
      `SELECT COUNT(*) as pending FROM response_action_approvals WHERE status = 'pending'`
    )
    .catch(() => ({ pending: 0 }));
  return { approvals: row || { pending: 0 } };
}

async function getHunting() {
  const row = await db
    .queryOne(`SELECT COUNT(*) as today FROM raw_events WHERE DATE(created_at) = CURDATE()`)
    .catch(() => ({ today: 0 }));
  return { events: row || { today: 0 } };
}

async function getProtection(tenantId = null) {
  const avScanService = require('../modules/antivirus/avScanService');
  const summary = await avScanService.getDashboardSummary(tenantId).catch(() => ({}));
  return { av: summary };
}

async function getAdmin() {
  return {
    tenants: await db.queryOne('SELECT COUNT(*) as total FROM tenants').catch(() => ({ total: 0 })),
  };
}

module.exports = {
  getOverview,
  getEndpoints,
  getEndpointDetail,
  getDetections,
  getInvestigation,
  getResponse,
  getHunting,
  getProtection,
  getAdmin,
};
