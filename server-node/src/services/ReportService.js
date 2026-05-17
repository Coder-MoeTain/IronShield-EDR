/**
 * SOC report generation (JSON/HTML/PDF-as-HTML summaries).
 */
const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const DashboardService = require('./DashboardService');
const MitreCoverageService = require('./MitreCoverageService');
const AuditLogService = require('./AuditLogService');
const SoftwareReportService = require('../modules/software/softwareReportService');

const REPORTS_DIR = path.join(process.cwd(), 'artifacts', 'reports');

const PLATFORM_REPORT_TYPES = [
  'daily_soc_summary',
  'weekly_security_posture',
  'endpoint_health',
  'incident_report',
  'alert_trend',
  'mitre_coverage',
  'audit_activity',
  'tenant_executive',
];

const SOFTWARE_REPORT_TYPES = SoftwareReportService.REPORT_TYPES;

async function createJob({ tenantId, reportType, format = 'json', params = {}, createdBy }) {
  const fmt = format === 'pdf' ? 'html' : format;
  const result = await db.execute(
    `INSERT INTO report_jobs (tenant_id, report_type, format, params_json, status, created_by, expires_at)
     VALUES (?, ?, ?, ?, 'running', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [tenantId, reportType, fmt, JSON.stringify(params), createdBy]
  );
  const jobId = result.insertId;
  try {
    const content = await generateReport(reportType, tenantId, params);
    if (content?.error) {
      throw new Error(content.error);
    }
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const ext = fmt === 'html' ? 'html' : 'json';
    const filePath = path.join(REPORTS_DIR, `${reportType}-${jobId}.${ext}`);
    if (fmt === 'html') {
      fs.writeFileSync(filePath, renderHtml(reportType, content), 'utf8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    }
    await db.query(
      `UPDATE report_jobs SET status = 'completed', download_path = ?, completed_at = NOW() WHERE id = ?`,
      [filePath, jobId]
    );
    await AuditLogService.log({
      username: createdBy,
      action: 'report.generate',
      resourceType: 'report',
      resourceId: String(jobId),
      details: { reportType, format: fmt },
    });
    return { jobId, download_path: filePath, status: 'completed' };
  } catch (err) {
    await db.query(`UPDATE report_jobs SET status = 'failed', completed_at = NOW() WHERE id = ?`, [jobId]);
    throw err;
  }
}

async function generateReport(type, tenantId, params) {
  if (SOFTWARE_REPORT_TYPES.includes(type)) {
    return SoftwareReportService.generateReport(tenantId, type, params);
  }

  const tenantFilter = tenantId != null ? 'AND e.tenant_id = ?' : '';
  const tenantParams = tenantId != null ? [tenantId] : [];

  switch (type) {
    case 'daily_soc_summary':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        dashboard: await DashboardService.getSummary(tenantId),
        alerts_by_severity: await safeQuery(
          `SELECT severity, COUNT(*) AS c FROM alerts a
           JOIN endpoints e ON e.id = a.endpoint_id
           WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) ${tenantFilter}
           GROUP BY severity`,
          tenantParams
        ),
      };
    case 'weekly_security_posture':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        dashboard: await DashboardService.getSummary(tenantId),
        alerts_7d: await safeQuery(
          `SELECT DATE(a.created_at) AS day, COUNT(*) AS c FROM alerts a
           JOIN endpoints e ON e.id = a.endpoint_id
           WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${tenantFilter}
           GROUP BY DATE(a.created_at) ORDER BY day`,
          tenantParams
        ),
        mitre: await MitreCoverageService.getCoverage(tenantId).catch(() => ({})),
      };
    case 'mitre_coverage':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        ...(await MitreCoverageService.getCoverage(tenantId)),
      };
    case 'endpoint_health':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        endpoints: await safeQuery(
          `SELECT status, COUNT(*) AS c FROM endpoints
           ${tenantId != null ? 'WHERE tenant_id = ?' : ''}
           GROUP BY status`,
          tenantParams
        ),
      };
    case 'incident_report':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        incidents: await safeQuery(
          `SELECT i.id, i.incident_id, i.title, i.severity, i.status, i.lifecycle_phase, i.created_at
           FROM incidents i
           LEFT JOIN endpoints e ON e.id = i.endpoint_id
           WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           ${tenantId != null ? 'AND (i.tenant_id = ? OR e.tenant_id = ?)' : ''}
           ORDER BY i.updated_at DESC LIMIT 200`,
          tenantId != null ? [tenantId, tenantId] : []
        ),
      };
    case 'alert_trend':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        trend: await safeQuery(
          `SELECT DATE(a.created_at) AS day, a.severity, COUNT(*) AS c
           FROM alerts a
           JOIN endpoints e ON e.id = a.endpoint_id
           WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${tenantFilter}
           GROUP BY DATE(a.created_at), a.severity
           ORDER BY day`,
          tenantParams
        ),
      };
    case 'audit_activity':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        audit: await safeQuery(
          `SELECT username, action, resource_type, created_at
           FROM audit_logs
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           ORDER BY created_at DESC LIMIT 500`
        ),
      };
    case 'tenant_executive':
      return {
        generated_at: new Date().toISOString(),
        report_type: type,
        summary: await DashboardService.getSummary(tenantId),
        top_risks: await safeQuery(
          `SELECT e.hostname, COUNT(a.id) AS alert_count
           FROM alerts a
           JOIN endpoints e ON e.id = a.endpoint_id
           WHERE a.severity IN ('critical','high') AND a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           ${tenantFilter}
           GROUP BY e.id, e.hostname
           ORDER BY alert_count DESC LIMIT 15`,
          tenantParams
        ),
        software_risk: await safeQuery(
          `SELECT COUNT(*) AS vulnerable FROM endpoint_software_inventory esi
           JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
           WHERE esr.risk_score >= 61 ${tenantId != null ? 'AND esi.tenant_id = ?' : ''}`,
          tenantId != null ? [tenantId] : []
        ).then((r) => r[0] || { vulnerable: 0 }),
      };
    default:
      return { error: 'unknown_report_type', type };
  }
}

async function safeQuery(sql, params = []) {
  try {
    return await db.query(sql, params);
  } catch {
    return [];
  }
}

function renderHtml(type, data) {
  const title = type.replace(/_/g, ' ');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>IronShield ${title}</title>
  <style>body{font-family:system-ui,sans-serif;margin:2rem}h1{color:#1e3a5f}pre{background:#f4f4f5;padding:1rem;overflow:auto}</style>
  </head><body>
  <h1>IronShield Report: ${title}</h1>
  <p>Generated ${data.generated_at || new Date().toISOString()}</p>
  <pre>${JSON.stringify(data, null, 2).replace(/</g, '&lt;')}</pre>
  </body></html>`;
}

async function listJobs(tenantId, limit = 50) {
  let sql = 'SELECT * FROM report_jobs WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  return db.query(sql, params).catch(() => []);
}

module.exports = {
  createJob,
  listJobs,
  generateReport,
  PLATFORM_REPORT_TYPES,
  SOFTWARE_REPORT_TYPES,
  ALL_REPORT_TYPES: [...PLATFORM_REPORT_TYPES, ...SOFTWARE_REPORT_TYPES],
};
