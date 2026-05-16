/**
 * BFF aggregations for compact 8-page console modules.
 */
const DashboardService = require('./DashboardService');
const AlertService = require('./AlertService');
const ProductionReadinessService = require('./ProductionReadinessService');
const TelemetryQualityService = require('./TelemetryQualityService');
const AlertFingerprintService = require('./AlertFingerprintService');
const EntityGraphService = require('./EntityGraphService');
const SafeAutomationService = require('./SafeAutomationService');
const AnalyticsMlService = require('./AnalyticsMlService');
const db = require('../utils/db');

function bffMeta(module, tabs = []) {
  return {
    module,
    tabs,
    generated_at: new Date().toISOString(),
  };
}

function bffPayload(meta, fields = {}) {
  return {
    meta,
    tabs: meta.tabs,
    health: { status: 'ok' },
    ...fields,
  };
}

async function getOverview(tenantId = null) {
  const [summary, readiness] = await Promise.all([
    DashboardService.getSummary(tenantId),
    ProductionReadinessService.getScore().catch(() => ({ score: 0, checks: [] })),
  ]);
  const ep = summary.endpoints || {};
  const alerts = summary.alerts || {};
  const meta = bffMeta('overview', [
    'executive', 'soc', 'endpoint-health', 'detection-analytics', 'system-health', 'tenant',
  ]);
  return bffPayload(meta, {
    kpis: {
      endpoints: { total: ep.total ?? 0, online: ep.online ?? 0, offline: ep.offline ?? 0 },
      alerts: {
        critical: alerts.critical ?? alerts.bySeverity?.critical ?? 0,
        high: alerts.high ?? alerts.bySeverity?.high ?? 0,
      },
      incidents: { open: summary.investigations?.open ?? 0 },
      ingestion: { eventsToday: summary.eventsToday ?? 0 },
    },
    production_readiness: readiness,
    recent: {
      alerts: summary.recentAlerts || [],
      investigations: summary.recentInvestigations || [],
    },
    permissions: { dashboard: 'dashboard:view' },
    summary,
  });
}

async function getEndpoints(tenantId = null) {
  const epFilter = tenantId != null ? ' WHERE tenant_id = ?' : '';
  const epParams = tenantId != null ? [tenantId] : [];
  const [row, telemetry] = await Promise.all([
    db.queryOne(
      `SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END), 0) as online
       FROM endpoints${epFilter}`,
      epParams
    ),
    TelemetryQualityService.listScores(tenantId, 10).catch(() => []),
  ]);
  const recent = await db.query(
    `SELECT id, hostname, status, last_heartbeat_at, agent_version
     FROM endpoints${epFilter} ORDER BY last_heartbeat_at DESC LIMIT 15`,
    epParams
  ).catch(() => []);
  const meta = bffMeta('endpoints', ['list', 'groups', 'timeline', 'processes', 'network', 'map', 'health']);
  return bffPayload(meta, {
    kpis: { endpoints: row || { total: 0, online: 0 } },
    telemetry_quality: telemetry,
    recent,
    permissions: { endpoint: 'endpoint:view' },
  });
}

async function getEndpointDetail(endpointId, tenantId = null) {
  const [endpoint, telemetry] = await Promise.all([
    (async () => {
      const params = [endpointId];
      let sql = 'SELECT * FROM endpoints WHERE id = ?';
      if (tenantId != null) {
        sql += ' AND tenant_id = ?';
        params.push(tenantId);
      }
      return db.queryOne(sql, params);
    })(),
    TelemetryQualityService.scoreEndpoint(endpointId).catch(() => null),
  ]);
  const meta = bffMeta('endpoint-detail', ['overview', 'timeline', 'processes', 'network', 'trust']);
  return bffPayload(meta, {
    endpoint,
    telemetry_quality: telemetry,
    kpis: telemetry ? { quality_score: telemetry.score } : {},
    health: { status: endpoint ? 'ok' : 'not_found' },
    permissions: { endpoint: 'endpoint:view' },
  });
}

async function getDetections(tenantId = null) {
  const [alertSummary, triage, groups, quality] = await Promise.all([
    AlertService.getSummary(tenantId),
    db.queryOne(
      `SELECT COUNT(*) as pending FROM triage_queue_items WHERE status IN ('open','pending')`
    ).catch(() => ({ pending: 0 })),
    AlertFingerprintService.listGroups(tenantId, 10).catch(() => []),
    AnalyticsMlService.detectionQualitySummary(tenantId).catch(() => ({})),
  ]);
  const recent = await AlertService.list({ limit: 15, offset: 0, tenantId }).catch(() => ({ items: [] }));
  const meta = bffMeta('detections', [
    'triage', 'alerts', 'rules', 'mitre', 'xdr', 'suppressions', 'analytics', 'quality',
  ]);
  return bffPayload(meta, {
    kpis: {
      alerts: alertSummary,
      triage_pending: triage?.pending ?? 0,
    },
    alert_groups: groups,
    detection_quality: quality,
    recent: recent.items || recent,
    permissions: { alert: 'alert:view', detection: 'detection:view' },
  });
}

async function getInvestigation(tenantId = null) {
  const [incidents, graph] = await Promise.all([
    db.queryOne(
      `SELECT COUNT(*) as total,
        SUM(CASE WHEN status IN ('open','investigating','triage') THEN 1 ELSE 0 END) as open
       FROM incidents`
    ).catch(() => ({ total: 0, open: 0 })),
    EntityGraphService.getInvestigationGraph(tenantId, 50).catch(() => ({ nodes: [], edges: [] })),
  ]);
  const meta = bffMeta('investigation', ['incidents', 'cases', 'evidence', 'graph', 'reports']);
  return bffPayload(meta, {
    kpis: { incidents },
    threat_graph: graph,
    permissions: { incident: 'incident:view' },
  });
}

async function getResponse(tenantId = null) {
  const pending = await db
    .queryOne(
      `SELECT COUNT(*) as pending FROM response_action_approvals WHERE status = 'pending'`
    )
    .catch(() => ({ pending: 0 }));
  const automations = await SafeAutomationService.listRules(tenantId).catch(() => []);
  const meta = bffMeta('response', ['approvals', 'active', 'rtr', 'playbooks', 'quarantine', 'history']);
  return bffPayload(meta, {
    kpis: { approvals_pending: pending?.pending ?? 0 },
    safe_automation_rules: automations,
    permissions: { response: 'response:view' },
  });
}

async function getHunting(tenantId = null) {
  const today = await db
    .queryOne(`SELECT COUNT(*) as today FROM raw_events WHERE DATE(created_at) = CURDATE()`)
    .catch(() => ({ today: 0 }));
  const meta = bffMeta('hunting', [
    'search', 'events', 'raw', 'normalized', 'network', 'xdr-events', 'realtime', 'iocs', 'web', 'saved',
  ]);
  return bffPayload(meta, {
    kpis: { events_today: today?.today ?? 0 },
    permissions: { hunting: 'hunting:view' },
  });
}

async function getProtection(tenantId = null) {
  const avScanService = require('../modules/antivirus/avScanService');
  const summary = await avScanService.getDashboardSummary(tenantId).catch(() => ({}));
  const meta = bffMeta('protection', [
    'overview', 'detections', 'quarantine', 'scans', 'policies', 'signatures', 'reputation', 'web', 'capabilities',
  ]);
  return bffPayload(meta, {
    kpis: { av: summary },
    permissions: { protection: 'dashboard:view' },
  });
}

async function getAdmin(tenantId = null) {
  const [tenants, readiness] = await Promise.all([
    db.queryOne('SELECT COUNT(*) as total FROM tenants').catch(() => ({ total: 0 })),
    ProductionReadinessService.getScore().catch(() => ({ score: 0, checks: [] })),
  ]);
  const meta = bffMeta('admin', [
    'settings', 'tenants', 'rbac', 'integrations', 'audit', 'reports', 'system-health', 'roadmap',
  ]);
  return bffPayload(meta, {
    kpis: { tenants },
    production_readiness: readiness,
    permissions: { audit: 'audit:view', system: 'system:admin' },
  });
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
