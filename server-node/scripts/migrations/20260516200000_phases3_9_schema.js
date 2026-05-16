/**
 * Phases 3–9 schema: enrollment single-use, alert evidence, response lifecycle, integrations, reports.
 */
const { withConnection, addColumnIfMissing, tableExists } = require('../lib/migrationHelpers');

async function up() {
  await withConnection(async (conn, database) => {
    if (await tableExists(conn, database, 'tenant_enrollment_tokens')) {
      await addColumnIfMissing(
        conn,
        database,
        'tenant_enrollment_tokens',
        'single_use',
        'ALTER TABLE tenant_enrollment_tokens ADD COLUMN single_use TINYINT(1) NOT NULL DEFAULT 0'
      );
      await addColumnIfMissing(
        conn,
        database,
        'tenant_enrollment_tokens',
        'consumed_at',
        'ALTER TABLE tenant_enrollment_tokens ADD COLUMN consumed_at DATETIME NULL'
      );
    }

    if (await tableExists(conn, database, 'alerts')) {
      await addColumnIfMissing(
        conn,
        database,
        'alerts',
        'risk_score',
        'ALTER TABLE alerts ADD COLUMN risk_score INT UNSIGNED NULL'
      );
      await addColumnIfMissing(
        conn,
        database,
        'alerts',
        'evidence_summary',
        'ALTER TABLE alerts ADD COLUMN evidence_summary JSON NULL'
      );
      await addColumnIfMissing(
        conn,
        database,
        'alerts',
        'disposition',
        "ALTER TABLE alerts ADD COLUMN disposition VARCHAR(32) NULL"
      );
    }

    if (await tableExists(conn, database, 'response_actions')) {
      await addColumnIfMissing(
        conn,
        database,
        'response_actions',
        'expires_at',
        'ALTER TABLE response_actions ADD COLUMN expires_at DATETIME NULL'
      );
      await addColumnIfMissing(
        conn,
        database,
        'response_actions',
        'lifecycle_status',
        "ALTER TABLE response_actions ADD COLUMN lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'requested'"
      );
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED NULL,
        type VARCHAR(32) NOT NULL,
        name VARCHAR(128) NOT NULL,
        config_json JSON NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_integrations_tenant (tenant_id),
        INDEX idx_integrations_type (type)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS report_jobs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED NULL,
        report_type VARCHAR(64) NOT NULL,
        format VARCHAR(16) NOT NULL DEFAULT 'json',
        params_json JSON NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        created_by VARCHAR(128) NULL,
        download_path VARCHAR(512) NULL,
        expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        INDEX idx_report_tenant (tenant_id),
        INDEX idx_report_status (status)
      ) ENGINE=InnoDB
    `);
  });
}

async function down() {
  await withConnection(async (conn) => {
    await conn.query('DROP TABLE IF EXISTS report_jobs');
    await conn.query('DROP TABLE IF EXISTS integrations');
  });
}

module.exports = { up, down };
