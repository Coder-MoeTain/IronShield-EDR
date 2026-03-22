/**
 * Alert management service
 */
const db = require('../utils/db');
const DetectionEngineService = require('./DetectionEngineService');
const EventNormalizationService = require('./EventNormalizationService');
const RiskService = require('../modules/risk/riskService');
const CorrelationService = require('./CorrelationService');
const NotificationService = require('./NotificationService');

async function createFromDetection(alerts) {
  const endpointIds = new Set();
  for (const a of alerts) {
    const result = await db.execute(
      `INSERT INTO alerts (endpoint_id, rule_id, title, description, severity, confidence, mitre_tactic, mitre_technique, source_event_ids, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.endpoint_id,
        a.rule_id,
        a.title,
        a.description,
        a.severity,
        a.confidence,
        a.mitre_tactic,
        a.mitre_technique,
        a.source_event_ids,
        a.first_seen,
        a.last_seen,
      ]
    );
    endpointIds.add(a.endpoint_id);
    const alertId = result?.insertId;
    if (alertId) {
      try {
        const ep = await db.queryOne('SELECT * FROM endpoints WHERE id = ?', [a.endpoint_id]);
        await NotificationService.notifyAlertCreated(
          { id: alertId, ...a },
          ep
        );
      } catch (_) {
        // Non-fatal
      }
    }
  }
  // Phase A: Update risk score for affected endpoints
  for (const epId of endpointIds) {
    try {
      await RiskService.calculateEndpointRisk(epId);
    } catch (err) {
      // Non-fatal
    }
  }
  // Phase A: Run correlation to create incidents from related alerts
  try {
    await CorrelationService.correlateRecentAlerts();
  } catch (err) {
    // Non-fatal
  }
}

async function applySlaBreaches() {
  try {
    await db.query(
      `UPDATE alerts a
       JOIN endpoints e ON e.id = a.endpoint_id
       SET a.sla_breached_at = NOW(), a.updated_at = NOW()
       WHERE a.due_at IS NOT NULL
         AND a.due_at < NOW()
         AND a.sla_breached_at IS NULL
         AND a.status IN ('new', 'investigating')`
    );
  } catch (_) {
    /* columns may be missing before migration */
  }
}

async function list(filters = {}) {
  await applySlaBreaches();

  let sql = `
    SELECT a.*, e.hostname,
      ROUND(LEAST(100, GREATEST(0,
        (CASE a.severity WHEN 'critical' THEN 95 WHEN 'high' THEN 75 WHEN 'medium' THEN 50 WHEN 'low' THEN 25 ELSE 15 END)
        * COALESCE(a.confidence, 0.5)
      ))) AS risk_score
    FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(filters.tenantId);
  }
  if (filters.endpointId) {
    sql += ' AND a.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.severity) {
    sql += ' AND a.severity = ?';
    params.push(filters.severity);
  }
  if (filters.status) {
    sql += ' AND a.status = ?';
    params.push(filters.status);
  }
  if (filters.assigned_to) {
    sql += ' AND a.assigned_to = ?';
    params.push(filters.assigned_to);
  }
  if (filters.assigned_team) {
    sql += ' AND a.assigned_team = ?';
    params.push(filters.assigned_team);
  }
  if (filters.dateFrom) {
    sql += ' AND a.first_seen >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    sql += ' AND a.first_seen <= ?';
    params.push(filters.dateTo);
  }

  sql += ' ORDER BY a.first_seen DESC LIMIT ? OFFSET ?';
  params.push(Math.min(filters.limit || 50, 200), filters.offset || 0);

  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne(
    `SELECT a.*, e.hostname, e.ip_address,
      ROUND(LEAST(100, GREATEST(0,
        (CASE a.severity WHEN 'critical' THEN 95 WHEN 'high' THEN 75 WHEN 'medium' THEN 50 WHEN 'low' THEN 25 ELSE 15 END)
        * COALESCE(a.confidence, 0.5)
      ))) AS risk_score
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     WHERE a.id = ?`,
    [id]
  );
}

async function updateStatus(id, status, assignedTo = null) {
  await db.query(
    'UPDATE alerts SET status = ?, assigned_to = COALESCE(?, assigned_to), updated_at = NOW() WHERE id = ?',
    [status, assignedTo, id]
  );
}

/**
 * Partial update: status, assignment, SLA, suppression
 */
async function patch(id, data = {}, tenantId = null) {
  const row = await db.queryOne(
    `SELECT a.id FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     WHERE a.id = ? ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [id, tenantId] : [id]
  );
  if (!row) return null;

  if (data.suppression_reason !== undefined && String(data.suppression_reason).trim()) {
    await db.query(
      `UPDATE alerts SET status = 'false_positive', suppression_reason = ?, suppressed_at = NOW(),
       suppressed_by = ?, updated_at = NOW() WHERE id = ?`,
      [String(data.suppression_reason).trim(), data.suppressed_by || null, id]
    );
    return getById(id);
  }

  const updates = [];
  const params = [];
  const fields = ['status', 'assigned_to', 'assigned_team', 'due_at', 'sla_minutes'];
  for (const f of fields) {
    if (data[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(data[f] === '' ? null : data[f]);
    }
  }
  if (updates.length === 0) return getById(id);
  updates.push('updated_at = NOW()');
  params.push(id);
  await db.query(`UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

async function addNote(alertId, author, note) {
  await db.query(
    'INSERT INTO alert_notes (alert_id, author, note) VALUES (?, ?, ?)',
    [alertId, author, note]
  );
}

async function getNotes(alertId) {
  return db.query(
    'SELECT * FROM alert_notes WHERE alert_id = ? ORDER BY created_at DESC',
    [alertId]
  );
}

async function getSummary(tenantId = null) {
  let sql = `
    SELECT
      SUM(CASE WHEN a.status = 'new' THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN a.status = 'investigating' THEN 1 ELSE 0 END) as investigating,
      SUM(CASE WHEN a.status = 'closed' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN a.status = 'false_positive' THEN 1 ELSE 0 END) as false_positive,
      SUM(CASE WHEN a.severity = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN a.severity = 'high' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN a.severity = 'medium' THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN a.severity = 'low' THEN 1 ELSE 0 END) as low,
      COUNT(*) as total
    FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE 1=1
  `;
  const params = [];
  if (tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  const rows = await db.query(sql, params);
  return rows?.[0] || { new: 0, investigating: 0, closed: 0, false_positive: 0, critical: 0, high: 0, medium: 0, low: 0, total: 0 };
}

module.exports = {
  createFromDetection,
  list,
  getById,
  updateStatus,
  patch,
  addNote,
  getNotes,
  getSummary,
  applySlaBreaches,
};
