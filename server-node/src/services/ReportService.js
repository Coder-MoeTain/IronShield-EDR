/**
 * SOC report generation (JSON/HTML summaries).
 */
const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const DashboardService = require('./DashboardService');
const MitreCoverageService = require('./MitreCoverageService');
const AuditLogService = require('./AuditLogService');

const REPORTS_DIR = path.join(process.cwd(), 'artifacts', 'reports');

async function createJob({ tenantId, reportType, format = 'json', params = {}, createdBy }) {
  const result = await db.execute(
    `INSERT INTO report_jobs (tenant_id, report_type, format, params_json, status, created_by, expires_at)
     VALUES (?, ?, ?, ?, 'running', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [tenantId, reportType, format, JSON.stringify(params), createdBy]
  );
  const jobId = result.insertId;
  try {
    const content = await generateReport(reportType, tenantId, params);
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const ext = format === 'html' ? 'html' : 'json';
    const filePath = path.join(REPORTS_DIR, `${reportType}-${jobId}.${ext}`);
    if (format === 'html') {
      fs.writeFileSync(filePath, renderHtml(reportType, content), 'utf8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    }
    await db.execute(
      `UPDATE report_jobs SET status = 'completed', download_path = ?, completed_at = NOW() WHERE id = ?`,
      [filePath, jobId]
    );
    await AuditLogService.log({
      username: createdBy,
      action: 'report.generate',
      resourceType: 'report',
      resourceId: String(jobId),
      details: { reportType, format },
    });
    return { jobId, download_path: filePath, status: 'completed' };
  } catch (err) {
    await db.execute(`UPDATE report_jobs SET status = 'failed', completed_at = NOW() WHERE id = ?`, [jobId]);
    throw err;
  }
}

async function generateReport(type, tenantId, params) {
  switch (type) {
    case 'daily_soc_summary':
      return {
        generated_at: new Date().toISOString(),
        dashboard: await DashboardService.getSummary(tenantId),
        alerts_by_severity: await db.query(
          `SELECT severity, COUNT(*) AS c FROM alerts a
           JOIN endpoints e ON e.id = a.endpoint_id
           WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
           ${tenantId != null ? 'AND e.tenant_id = ?' : ''}
           GROUP BY severity`,
          tenantId != null ? [tenantId] : []
        ),
      };
    case 'mitre_coverage':
      return MitreCoverageService.getCoverage(tenantId);
    case 'endpoint_health':
      return db.query(
        `SELECT status, COUNT(*) AS c FROM endpoints
         ${tenantId != null ? 'WHERE tenant_id = ?' : ''}
         GROUP BY status`,
        tenantId != null ? [tenantId] : []
      );
    default:
      return { error: 'unknown_report_type', type };
  }
}

function renderHtml(type, data) {
  return `<!DOCTYPE html><html><head><title>IronShield ${type}</title></head><body>
  <h1>IronShield Report: ${type}</h1>
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

module.exports = { createJob, listJobs, generateReport };
