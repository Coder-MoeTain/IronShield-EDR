/**
 * Phase C: NDJSON export of alerts for SIEM pipelines (Splunk, Elastic, etc.)
 */
const db = require('../utils/db');

async function streamAlertsNdjson(res, filters = {}) {
  let sql = `
    SELECT a.*, e.hostname
    FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE 1=1
  `;
  const params = [];
  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.since) {
    sql += ' AND a.first_seen >= ?';
    params.push(filters.since);
  }
  sql += ' ORDER BY a.id DESC LIMIT 10000';

  const rows = await db.query(sql, params);
  for (const row of rows || []) {
    res.write(`${JSON.stringify({ type: 'ironshield.alert', exported_at: new Date().toISOString(), ...row })}\n`);
  }
}

module.exports = { streamAlertsNdjson };
