/**
 * Safe automation rules — never auto-execute high-risk response.
 */
const db = require('../utils/db');

const SAFE_ACTIONS = new Set([
  'auto_create_incident',
  'auto_assign_alert',
  'auto_enrich_ioc',
  'auto_request_response_action',
  'auto_suppress_benign',
]);

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS safe_automation_rules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(128) NOT NULL,
      action_type VARCHAR(64) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      conditions_json JSON NULL,
      expiry_at DATETIME NULL,
      tenant_id BIGINT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_safe_auto_tenant (tenant_id),
      KEY idx_safe_auto_action (action_type)
    )
  `);
}

async function listRules(tenantId = null) {
  await ensureTable();
  let sql = 'SELECT * FROM safe_automation_rules WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  sql += ' ORDER BY name';
  return db.query(sql, params);
}

async function runForAlert(alert, tenantId = null) {
  await ensureTable();
  const rules = await listRules(tenantId);
  const results = [];
  for (const rule of rules) {
    if (!rule.enabled || !SAFE_ACTIONS.has(rule.action_type)) continue;
    if (rule.expiry_at && new Date(rule.expiry_at) < new Date()) continue;

    switch (rule.action_type) {
      case 'auto_create_incident':
        results.push({ action: rule.action_type, status: 'queued', alert_id: alert.id });
        break;
      case 'auto_assign_alert':
        results.push({ action: rule.action_type, status: 'skipped', reason: 'requires_assignee_config' });
        break;
      case 'auto_enrich_ioc':
        results.push({ action: rule.action_type, status: 'queued' });
        break;
      case 'auto_request_response_action':
        results.push({ action: rule.action_type, status: 'requires_approval' });
        break;
      case 'auto_suppress_benign':
        results.push({ action: rule.action_type, status: 'queued', expires: rule.expiry_at });
        break;
      default:
        break;
    }
  }
  return results;
}

module.exports = { SAFE_ACTIONS, listRules, runForAlert, ensureTable };
