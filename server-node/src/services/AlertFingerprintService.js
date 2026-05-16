/**
 * Alert fingerprinting and duplicate grouping.
 */
const db = require('../utils/db');
const crypto = require('crypto');

const WINDOW_HOURS = 24;

function buildFingerprint(a) {
  const parts = [
    a.rule_id || a.ruleId || '',
    a.endpoint_id || a.endpointId || '',
    a.title || '',
    a.process_name || a.processName || '',
    a.user_name || a.userName || '',
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 64);
}

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      fingerprint VARCHAR(64) NOT NULL,
      rule_id BIGINT NULL,
      endpoint_id BIGINT NOT NULL,
      title VARCHAR(512) NOT NULL,
      severity VARCHAR(32) NOT NULL,
      event_count INT UNSIGNED NOT NULL DEFAULT 1,
      first_seen DATETIME NOT NULL,
      last_seen DATETIME NOT NULL,
      representative_alert_id BIGINT NULL,
      grouped_evidence_json JSON NULL,
      tenant_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_alert_groups_fp (fingerprint, endpoint_id),
      KEY idx_alert_groups_last_seen (last_seen),
      KEY idx_alert_groups_endpoint (endpoint_id)
    )
  `);
}

async function upsertGroup(alert, fingerprint) {
  await ensureTable();
  const existing = await db.queryOne(
    `SELECT * FROM alert_groups
     WHERE fingerprint = ? AND endpoint_id = ?
       AND last_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [fingerprint, alert.endpoint_id, WINDOW_HOURS]
  );

  if (existing) {
    await db.execute(
      `UPDATE alert_groups SET
         event_count = event_count + 1,
         last_seen = COALESCE(?, NOW()),
         severity = ?,
         representative_alert_id = COALESCE(representative_alert_id, ?),
         grouped_evidence_json = JSON_MERGE_PATCH(COALESCE(grouped_evidence_json, '{}'), ?),
         updated_at = NOW()
       WHERE id = ?`,
      [
        alert.last_seen || alert.first_seen,
        alert.severity,
        alert.id || null,
        JSON.stringify({ last_alert_id: alert.id, title: alert.title }),
        existing.id,
      ]
    );
    return { grouped: true, groupId: existing.id, eventCount: existing.event_count + 1 };
  }

  const ins = await db.execute(
    `INSERT INTO alert_groups
     (fingerprint, rule_id, endpoint_id, title, severity, event_count, first_seen, last_seen, representative_alert_id, grouped_evidence_json)
     VALUES (?, ?, ?, ?, ?, 1, COALESCE(?, NOW()), COALESCE(?, NOW()), ?, ?)`,
    [
      fingerprint,
      alert.rule_id || null,
      alert.endpoint_id,
      alert.title,
      alert.severity,
      alert.first_seen,
      alert.last_seen,
      alert.id || null,
      JSON.stringify({ alert_ids: alert.id ? [alert.id] : [] }),
    ]
  );
  return { grouped: false, groupId: ins?.insertId, eventCount: 1 };
}

async function processAlert(alert) {
  const fp = buildFingerprint(alert);
  return upsertGroup(alert, fp);
}

async function listGroups(tenantId = null, limit = 50) {
  await ensureTable();
  let sql = `
    SELECT g.*, e.hostname
    FROM alert_groups g
    JOIN endpoints e ON e.id = g.endpoint_id
    WHERE g.last_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  `;
  const params = [];
  if (tenantId != null) {
    sql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' ORDER BY g.event_count DESC, g.last_seen DESC LIMIT ?';
  params.push(limit);
  return db.query(sql, params);
}

module.exports = { buildFingerprint, processAlert, listGroups, ensureTable };
