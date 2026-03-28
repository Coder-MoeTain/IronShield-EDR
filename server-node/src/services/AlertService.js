/**
 * Alert management service
 */
const db = require('../utils/db');
const metrics = require('../utils/metrics');
const DetectionEngineService = require('./DetectionEngineService');
const EventNormalizationService = require('./EventNormalizationService');
const RiskService = require('../modules/risk/riskService');
const CorrelationService = require('./CorrelationService');
const NotificationService = require('./NotificationService');
const SiemPushService = require('./SiemPushService');
const MISSING_TABLE_ERRORS = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);
let qualityTableReady = false;

function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean);
  return String(input)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function ensureQualityEventsTable() {
  if (qualityTableReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_quality_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      alert_id BIGINT NOT NULL,
      endpoint_id BIGINT NULL,
      tenant_id BIGINT NULL,
      event_type VARCHAR(64) NOT NULL,
      analyst_disposition VARCHAR(64) NULL,
      disposition_reason TEXT NULL,
      analyst_confidence DECIMAL(4,3) NULL,
      quality_tags_json JSON NULL,
      old_status VARCHAR(64) NULL,
      new_status VARCHAR(64) NULL,
      created_by VARCHAR(128) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_dqe_alert_created (alert_id, created_at),
      KEY idx_dqe_tenant_created (tenant_id, created_at)
    )
  `);
  qualityTableReady = true;
}

async function getAlertTenantEndpoint(alertId) {
  return db.queryOne(
    `SELECT a.id, a.status, a.endpoint_id, e.tenant_id
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     WHERE a.id = ?`,
    [alertId]
  );
}

async function recordQualityEvent(alertId, payload = {}, actor = null, tenantId = null) {
  try {
    await ensureQualityEventsTable();
    const row = await getAlertTenantEndpoint(alertId);
    if (!row) return;
    if (tenantId != null && row.tenant_id != null && Number(row.tenant_id) !== Number(tenantId)) return;
    await db.execute(
      `INSERT INTO detection_quality_events
       (alert_id, endpoint_id, tenant_id, event_type, analyst_disposition, disposition_reason,
        analyst_confidence, quality_tags_json, old_status, new_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alertId,
        row.endpoint_id || null,
        row.tenant_id || null,
        String(payload.event_type || 'analyst_feedback').substring(0, 64),
        payload.analyst_disposition || null,
        payload.disposition_reason || null,
        payload.analyst_confidence == null ? null : Number(payload.analyst_confidence),
        JSON.stringify(parseTags(payload.quality_tags)),
        payload.old_status || null,
        payload.new_status || null,
        actor || null,
      ]
    );
  } catch (err) {
    if (MISSING_TABLE_ERRORS.has(err?.code)) return;
    throw err;
  }
}

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
      const sev = String(a.severity || 'medium').toLowerCase();
      metrics.alertsCreatedFromDetectionTotal.inc({
        severity: ['low', 'medium', 'high', 'critical'].includes(sev) ? sev : 'medium',
      });
      try {
        const ep = await db.queryOne('SELECT * FROM endpoints WHERE id = ?', [a.endpoint_id]);
        await NotificationService.notifyAlertCreated(
          { id: alertId, ...a },
          ep
        );
        await SiemPushService.emit('ironshield.alert', { alert_id: alertId, alert: { id: alertId, ...a }, endpoint: ep });
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
  if (filters.rule_id) {
    sql += ' AND a.rule_id = ?';
    params.push(filters.rule_id);
  }
  if (filters.status) {
    sql += ' AND a.status = ?';
    params.push(filters.status);
  }
  if (filters.status_group) {
    if (filters.status_group === 'active') {
      sql += " AND a.status IN ('new', 'investigating')";
    } else if (filters.status_group === 'closed_only') {
      sql += " AND a.status IN ('closed', 'false_positive')";
    }
  }
  if (filters.assigned_to) {
    sql += ' AND a.assigned_to = ?';
    params.push(filters.assigned_to);
  }
  if (filters.assigned_state) {
    if (filters.assigned_state === 'unassigned') {
      sql += " AND (a.assigned_to IS NULL OR TRIM(a.assigned_to) = '')";
    } else if (filters.assigned_state === 'assigned') {
      sql += " AND (a.assigned_to IS NOT NULL AND TRIM(a.assigned_to) <> '')";
    }
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
  const before = await db.queryOne('SELECT status FROM alerts WHERE id = ?', [id]);
  await db.query(
    'UPDATE alerts SET status = ?, assigned_to = COALESCE(?, assigned_to), updated_at = NOW() WHERE id = ?',
    [status, assignedTo, id]
  );
  await recordQualityEvent(
    id,
    {
      event_type: 'status_update',
      old_status: before?.status || null,
      new_status: status || null,
    },
    null,
    null
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
    const before = await db.queryOne('SELECT status FROM alerts WHERE id = ?', [id]);
    await db.query(
      `UPDATE alerts SET status = 'false_positive', suppression_reason = ?, suppressed_at = NOW(),
       suppressed_by = ?, updated_at = NOW() WHERE id = ?`,
      [String(data.suppression_reason).trim(), data.suppressed_by || null, id]
    );
    await recordQualityEvent(
      id,
      {
        event_type: 'suppression',
        analyst_disposition: 'false_positive',
        disposition_reason: String(data.suppression_reason).trim(),
        old_status: before?.status || null,
        new_status: 'false_positive',
      },
      data.suppressed_by || data.updated_by || null,
      tenantId
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
  const before = await db.queryOne('SELECT status FROM alerts WHERE id = ?', [id]);
  await db.query(`UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`, params);

  if (
    data.analyst_disposition !== undefined
    || data.disposition_reason !== undefined
    || data.analyst_confidence !== undefined
    || data.quality_tags !== undefined
    || data.status !== undefined
  ) {
    await recordQualityEvent(
      id,
      {
        event_type: 'analyst_feedback',
        analyst_disposition: data.analyst_disposition || null,
        disposition_reason: data.disposition_reason || null,
        analyst_confidence: data.analyst_confidence == null ? null : Number(data.analyst_confidence),
        quality_tags: data.quality_tags,
        old_status: before?.status || null,
        new_status: data.status || before?.status || null,
      },
      data.updated_by || null,
      tenantId
    );
  }
  return getById(id);
}

async function listQualityEvents(alertId, limit = 50) {
  try {
    await ensureQualityEventsTable();
    return db.query(
      `SELECT id, alert_id, endpoint_id, tenant_id, event_type, analyst_disposition,
              disposition_reason, analyst_confidence, quality_tags_json, old_status, new_status,
              created_by, created_at
       FROM detection_quality_events
       WHERE alert_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [alertId, Math.min(Number(limit) || 50, 200)]
    );
  } catch (err) {
    if (MISSING_TABLE_ERRORS.has(err?.code)) return [];
    throw err;
  }
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
  listQualityEvents,
  recordQualityEvent,
};
