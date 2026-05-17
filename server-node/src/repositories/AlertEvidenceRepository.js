const db = require('../utils/db');

async function ensureTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_matched_conditions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      alert_id BIGINT NOT NULL,
      tenant_id BIGINT UNSIGNED NULL,
      field_name VARCHAR(128) NOT NULL,
      operator VARCHAR(32) NOT NULL,
      expected_value TEXT NULL,
      actual_value TEXT NULL,
      matched TINYINT(1) NOT NULL DEFAULT 1,
      condition_path VARCHAR(256) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_amc_alert (alert_id)
    ) ENGINE=InnoDB
  `);
}

async function insertMatchedConditions(alertId, conditions = [], tenantId = null) {
  if (!conditions.length) return;
  await ensureTables();
  for (const c of conditions) {
    await db.execute(
      `INSERT INTO alert_matched_conditions
       (alert_id, tenant_id, field_name, operator, expected_value, actual_value, matched, condition_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alertId,
        tenantId,
        c.field || c.field_name,
        c.operator || c.op,
        c.expected != null ? String(c.expected).slice(0, 4096) : null,
        c.actual != null ? String(c.actual).slice(0, 4096) : null,
        c.matched !== false ? 1 : 0,
        c.condition_path || null,
      ]
    );
  }
}

async function insertRiskBreakdown(alertId, factors = [], tenantId = null) {
  if (!factors.length) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_risk_breakdown (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      alert_id BIGINT NOT NULL,
      tenant_id BIGINT UNSIGNED NULL,
      factor VARCHAR(128) NOT NULL,
      points INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_arb_alert (alert_id)
    ) ENGINE=InnoDB
  `);
  for (const f of factors) {
    await db.execute(
      `INSERT INTO alert_risk_breakdown (alert_id, tenant_id, factor, points) VALUES (?, ?, ?, ?)`,
      [alertId, tenantId, f.factor || f.name, f.points || 0]
    );
  }
}

async function listByAlertId(alertId) {
  await ensureTables();
  const conditions = await db.query(
    'SELECT * FROM alert_matched_conditions WHERE alert_id = ? ORDER BY id',
    [alertId]
  ).catch(() => []);
  const risk = await db.query(
    'SELECT * FROM alert_risk_breakdown WHERE alert_id = ? ORDER BY id',
    [alertId]
  ).catch(() => []);
  const confidence = await db.query(
    'SELECT * FROM alert_confidence_breakdown WHERE alert_id = ? ORDER BY id',
    [alertId]
  ).catch(() => []);
  return { conditions, risk, confidence };
}

module.exports = { insertMatchedConditions, insertRiskBreakdown, listByAlertId, ensureTables };
