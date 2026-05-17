/**
 * Alert fingerprinting and deduplication within configurable window.
 */
const db = require('../../utils/db');
const crypto = require('crypto');

const DEFAULT_WINDOW_MINUTES = Number(process.env.ALERT_DEDUP_WINDOW_MINUTES) || 15;
const MAX_GROUPED_EVIDENCE = Number(process.env.ALERT_MAX_GROUPED_EVIDENCE) || 100;

function normalizeCommandLine(cmd) {
  if (!cmd) return '';
  return String(cmd)
    .toLowerCase()
    .replace(/[0-9a-f]{8,}/gi, '<hex>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 256);
}

function buildFingerprint(alert, norm = {}) {
  const parts = [
    alert.tenant_id || '',
    alert.rule_id || alert.ruleId || '',
    alert.endpoint_id || alert.endpointId || '',
    alert.user_name || norm.user_name || norm.raw_event_json?.user_name || '',
    alert.process_name || norm.process_name || '',
    norm.parent_process_name || norm.raw_event_json?.parent_process_name || '',
    normalizeCommandLine(alert.command_line || norm.command_line),
    norm.file_hash_sha256 || '',
    norm.destination_ip || norm.raw_event_json?.destination_ip || '',
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 64);
}

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_fingerprints (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tenant_id BIGINT UNSIGNED NULL,
      fingerprint_hash VARCHAR(64) NOT NULL,
      rule_id VARCHAR(64) NULL,
      endpoint_id BIGINT NOT NULL,
      user_name VARCHAR(256) NULL,
      process_name VARCHAR(512) NULL,
      first_seen DATETIME NOT NULL,
      last_seen DATETIME NOT NULL,
      event_count INT UNSIGNED NOT NULL DEFAULT 1,
      alert_id BIGINT NULL,
      grouped_evidence_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_alert_fp (fingerprint_hash, endpoint_id, rule_id),
      KEY idx_alert_fp_last_seen (last_seen),
      KEY idx_alert_fp_alert (alert_id)
    ) ENGINE=InnoDB
  `);
}

async function findDuplicate(fingerprint, endpointId, ruleId, windowMinutes) {
  await ensureTable();
  return db.queryOne(
    `SELECT * FROM alert_fingerprints
     WHERE fingerprint_hash = ? AND endpoint_id = ? AND rule_id = ?
       AND last_seen >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
     ORDER BY last_seen DESC LIMIT 1`,
    [fingerprint, endpointId, String(ruleId), windowMinutes]
  );
}

async function processDedup(alert, norm = {}, opts = {}) {
  const windowMinutes = opts.windowMinutes || DEFAULT_WINDOW_MINUTES;
  const fingerprint = buildFingerprint(alert, norm);
  const existing = await findDuplicate(fingerprint, alert.endpoint_id, alert.rule_id, windowMinutes);

  if (existing) {
    const evidence = [];
    try {
      const parsed = typeof existing.grouped_evidence_json === 'string'
        ? JSON.parse(existing.grouped_evidence_json)
        : existing.grouped_evidence_json;
      if (parsed?.items) evidence.push(...parsed.items);
    } catch {
      /* ignore */
    }
    evidence.push({
      alert_id: alert.id,
      at: alert.last_seen || new Date().toISOString(),
      summary: alert.title,
    });
    const trimmed = evidence.slice(-MAX_GROUPED_EVIDENCE);

    await db.execute(
      `UPDATE alert_fingerprints SET
         last_seen = COALESCE(?, NOW()),
         event_count = event_count + 1,
         alert_id = COALESCE(alert_id, ?),
         grouped_evidence_json = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        alert.last_seen,
        alert.id || null,
        JSON.stringify({ items: trimmed }),
        existing.id,
      ]
    );
    return { duplicate: true, fingerprint_id: existing.id, event_count: existing.event_count + 1 };
  }

  await db.execute(
    `INSERT INTO alert_fingerprints
     (tenant_id, fingerprint_hash, rule_id, endpoint_id, user_name, process_name,
      first_seen, last_seen, event_count, alert_id, grouped_evidence_json)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), COALESCE(?, NOW()), 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_seen = VALUES(last_seen),
       event_count = event_count + 1,
       alert_id = COALESCE(alert_id, VALUES(alert_id))`,
    [
      alert.tenant_id || null,
      fingerprint,
      String(alert.rule_id || ''),
      alert.endpoint_id,
      alert.user_name || null,
      alert.process_name || null,
      alert.first_seen,
      alert.last_seen,
      alert.id || null,
      JSON.stringify({ items: alert.id ? [{ alert_id: alert.id }] : [] }),
    ]
  );
  return { duplicate: false, fingerprint };
}

module.exports = {
  buildFingerprint,
  processDedup,
  ensureTable,
  DEFAULT_WINDOW_MINUTES,
};
