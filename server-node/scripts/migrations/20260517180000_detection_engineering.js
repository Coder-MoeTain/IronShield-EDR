/**
 * Detection engineering platform tables.
 */
const { withConnection } = require('../lib/migrationHelpers');

async function up() {
  await withConnection(async (conn) => {
    await conn.query(`
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

    await conn.query(`
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS alert_confidence_breakdown (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        alert_id BIGINT NOT NULL,
        tenant_id BIGINT UNSIGNED NULL,
        factor VARCHAR(128) NOT NULL,
        points INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_acb_alert (alert_id)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS detection_quality_metrics (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NULL,
        rule_id VARCHAR(64) NOT NULL,
        hit_count INT UNSIGNED NOT NULL DEFAULT 0,
        alert_count INT UNSIGNED NOT NULL DEFAULT 0,
        true_positive_count INT UNSIGNED NOT NULL DEFAULT 0,
        false_positive_count INT UNSIGNED NOT NULL DEFAULT 0,
        false_positive_rate DECIMAL(5,4) NULL,
        quality_score INT UNSIGNED NOT NULL DEFAULT 0,
        noisy_score DECIMAL(5,4) NULL,
        last_fired DATETIME NULL,
        last_updated DATETIME NULL,
        tests_passing TINYINT(1) NOT NULL DEFAULT 0,
        metrics_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_dqm_tenant_rule (tenant_id, rule_id),
        KEY idx_dqm_quality (quality_score)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS detection_rule_tenant_overrides (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NOT NULL,
        rule_id VARCHAR(64) NOT NULL,
        enabled TINYINT(1) NULL,
        severity_override VARCHAR(32) NULL,
        risk_score_override INT NULL,
        created_by VARCHAR(128) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_drto (tenant_id, rule_id)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS detection_rule_test_results (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rule_id VARCHAR(64) NOT NULL,
        test_id VARCHAR(128) NOT NULL,
        passed TINYINT(1) NOT NULL,
        run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        details_json JSON NULL,
        KEY idx_drtr_rule (rule_id, run_at)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS suppression_rules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NULL,
        rule_id VARCHAR(64) NULL,
        scope_type VARCHAR(32) NOT NULL,
        scope_value VARCHAR(512) NOT NULL,
        reason TEXT NOT NULL,
        created_by VARCHAR(128) NULL,
        approved_by VARCHAR(128) NULL,
        expires_at DATETIME NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        matched_alert_count INT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_suppression_tenant (tenant_id, enabled),
        KEY idx_suppression_expires (expires_at)
      ) ENGINE=InnoDB
    `);

    try {
      await conn.query(`
        ALTER TABLE detection_rule_versions
          ADD COLUMN rule_code VARCHAR(64) NULL AFTER rule_id,
          ADD COLUMN change_summary TEXT NULL,
          ADD COLUMN approved_by VARCHAR(128) NULL,
          ADD COLUMN status VARCHAR(32) NULL DEFAULT 'draft'
      `);
    } catch {
      /* columns may exist */
    }
  });
}

async function down() {
  await withConnection(async (conn) => {
    const tables = [
      'suppression_rules',
      'detection_rule_test_results',
      'detection_rule_tenant_overrides',
      'detection_quality_metrics',
      'alert_confidence_breakdown',
      'alert_risk_breakdown',
      'alert_matched_conditions',
    ];
    for (const t of tables) {
      await conn.query(`DROP TABLE IF EXISTS ${t}`);
    }
  });
}

module.exports = { up, down };
