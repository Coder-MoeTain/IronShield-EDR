/**
 * Alert explainability — structured evidence rows per alert.
 */
const db = require('../utils/db');

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_evidence (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      alert_id BIGINT NOT NULL,
      matched_field VARCHAR(128) NULL,
      matched_value TEXT NULL,
      rule_condition VARCHAR(512) NULL,
      risk_contribution INT NULL,
      explanation TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_alert_evidence_alert (alert_id)
    ) ENGINE=InnoDB
  `);
  tableReady = true;
}

async function insertMany(alertId, items = []) {
  if (!items.length) return;
  await ensureTable();
  let order = 0;
  for (const item of items) {
    await db.execute(
      `INSERT INTO alert_evidence (alert_id, matched_field, matched_value, rule_condition, risk_contribution, explanation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        alertId,
        item.matched_field || item.field || null,
        item.matched_value != null ? String(item.matched_value).substring(0, 4096) : null,
        item.rule_condition || item.condition_path || null,
        item.risk_contribution != null ? Number(item.risk_contribution) : null,
        item.explanation || null,
        item.sort_order != null ? item.sort_order : order++,
      ]
    );
  }
}

async function listByAlertId(alertId) {
  try {
    await ensureTable();
    return db.query(
      `SELECT * FROM alert_evidence WHERE alert_id = ? ORDER BY sort_order ASC, id ASC`,
      [alertId]
    );
  } catch (err) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(String(err?.code || ''))) return [];
    throw err;
  }
}

function buildFromDetectionBreakdown(breakdown, alertRow = {}) {
  const items = [];
  const fields = breakdown?.matched_fields || [];
  for (let i = 0; i < fields.length; i++) {
    const m = fields[i];
    items.push({
      matched_field: m.field,
      matched_value: m.value,
      rule_condition: m.condition_path || m.op,
      risk_contribution: m.risk_contribution ?? breakdown?.risk_contribution,
      explanation: m.explanation || `Matched ${m.field} ${m.op || ''} ${m.value ?? ''}`.trim(),
      sort_order: i,
    });
  }
  if (!items.length && breakdown?.rule_name) {
    items.push({
      matched_field: 'rule',
      matched_value: breakdown.rule_id || breakdown.rule_name,
      rule_condition: breakdown.logic_summary,
      risk_contribution: alertRow.risk_score,
      explanation: breakdown.summary || alertRow.description,
      sort_order: 0,
    });
  }
  return items;
}

module.exports = {
  ensureTable,
  insertMany,
  listByAlertId,
  buildFromDetectionBreakdown,
};
