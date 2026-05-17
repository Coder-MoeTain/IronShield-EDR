/**
 * Software risk reports — CSV/JSON/HTML export.
 */
const SoftwareInventoryService = require('./softwareInventoryService');
const SoftwareRemediationService = require('./softwareRemediationService');
const SoftwareBlockPolicyService = require('./softwareBlockPolicyService');
const db = require('../../utils/db');

const REPORT_TYPES = Object.freeze([
  'vulnerable',
  'critical-risk',
  'endpoint-inventory',
  'blocked',
  'remediation-status',
  'accepted-risk',
]);

async function generateReport(tenantId, reportType, filters = {}) {
  switch (reportType) {
    case 'vulnerable':
      return vulnerableSoftwareReport(tenantId, filters);
    case 'critical-risk':
      return criticalRiskReport(tenantId, filters);
    case 'endpoint-inventory':
      return endpointInventoryReport(tenantId, filters);
    case 'blocked':
      return blockedSoftwareReport(tenantId, filters);
    case 'remediation-status':
      return remediationStatusReport(tenantId, filters);
    case 'accepted-risk':
      return acceptedRiskReport(tenantId, filters);
    default:
      throw Object.assign(new Error(`Unknown report type: ${reportType}`), { code: 'INVALID_REPORT' });
  }
}

async function vulnerableSoftwareReport(tenantId, filters) {
  const { rows } = await SoftwareInventoryService.listInventory({
    tenantId,
    riskScoreMin: 61,
    limit: filters.limit || 5000,
    ...filters,
  });
  return {
    report_type: 'vulnerable',
    title: 'Vulnerable Software Report',
    generated_at: new Date().toISOString(),
    row_count: rows.length,
    rows: rows.map(mapInventoryRow),
  };
}

async function criticalRiskReport(tenantId, filters) {
  const { rows } = await SoftwareInventoryService.listInventory({
    tenantId,
    riskLevel: 'critical',
    limit: filters.limit || 5000,
    ...filters,
  });
  return {
    report_type: 'critical-risk',
    title: 'Critical Software Risk Report',
    generated_at: new Date().toISOString(),
    row_count: rows.length,
    rows: rows.map(mapInventoryRow),
  };
}

async function endpointInventoryReport(tenantId, filters) {
  const { rows } = await SoftwareInventoryService.listInventory({
    tenantId,
    endpointId: filters.endpoint_id,
    limit: filters.limit || 5000,
    ...filters,
  });
  return {
    report_type: 'endpoint-inventory',
    title: 'Endpoint Software Inventory Report',
    generated_at: new Date().toISOString(),
    row_count: rows.length,
    rows: rows.map(mapInventoryRow),
  };
}

async function blockedSoftwareReport(tenantId, filters) {
  const { rows } = await SoftwareInventoryService.listInventory({
    tenantId,
    blocked: true,
    limit: filters.limit || 5000,
    ...filters,
  });
  const policies = await SoftwareBlockPolicyService.list(tenantId, { enabled: 1, limit: 500 });
  return {
    report_type: 'blocked',
    title: 'Blocked Software Report',
    generated_at: new Date().toISOString(),
    row_count: rows.length,
    inventory: rows.map(mapInventoryRow),
    policies,
  };
}

async function remediationStatusReport(tenantId, filters) {
  const { rows } = await SoftwareRemediationService.listActions(tenantId, {
    limit: filters.limit || 5000,
    ...filters,
  });
  return {
    report_type: 'remediation-status',
    title: 'Remediation Status Report',
    generated_at: new Date().toISOString(),
    row_count: rows.length,
    rows,
  };
}

async function acceptedRiskReport(tenantId, filters) {
  const rows = await db.query(
    `SELECT esi.*, e.hostname, esr.risk_score, esr.risk_level, esr.accepted_risk_until, esr.reason
     FROM endpoint_software_inventory esi
     JOIN endpoints e ON e.id = esi.endpoint_id
     JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
     WHERE esi.tenant_id = ? AND esr.accepted_risk = 1 AND esi.status = 'installed'
     ORDER BY esr.accepted_risk_until ASC LIMIT ?`,
    [tenantId, Number(filters.limit) || 5000]
  );
  return {
    report_type: 'accepted-risk',
    title: 'Accepted Risk Report',
    generated_at: new Date().toISOString(),
    row_count: (rows || []).length,
    rows: (rows || []).map(mapInventoryRow),
  };
}

function mapInventoryRow(r) {
  return {
    id: r.id,
    name: r.name,
    vendor: r.vendor,
    version: r.version,
    hostname: r.hostname,
    endpoint_id: r.endpoint_id,
    risk_score: r.risk_score,
    risk_level: r.risk_level,
    blocked: !!r.blocked,
    accepted_risk: !!r.accepted_risk,
    recommended_action: r.recommended_action,
    last_seen_at: r.last_seen_at,
    reason: r.reason,
  };
}

function toCsv(report) {
  const rows = report.rows || report.inventory || [];
  if (!rows.length) return 'name,vendor,version,hostname,risk_score,risk_level,blocked\n';
  const header = 'name,vendor,version,hostname,risk_score,risk_level,blocked,reason\n';
  const lines = rows.map(
    (r) =>
      `"${(r.name || '').replace(/"/g, '""')}","${r.vendor || ''}","${r.version || ''}","${r.hostname || ''}",${r.risk_score || 0},${r.risk_level || ''},${r.blocked ? 1 : 0},"${(r.reason || '').replace(/"/g, '""')}"`
  );
  return header + lines.join('\n');
}

function toHtml(report) {
  const rows = report.rows || report.inventory || [];
  const th = '<tr><th>Software</th><th>Vendor</th><th>Version</th><th>Endpoint</th><th>Risk</th><th>Level</th></tr>';
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.vendor)}</td><td>${escapeHtml(r.version)}</td><td>${escapeHtml(r.hostname)}</td><td>${r.risk_score}</td><td>${r.risk_level}</td></tr>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title></head><body><h1>${escapeHtml(report.title)}</h1><p>Generated: ${report.generated_at}</p><table border="1">${th}${body}</table></body></html>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  REPORT_TYPES,
  generateReport,
  toCsv,
  toHtml,
};
