/**
 * Migration: SOC hardening baseline
 * - admin login lockout controls
 * - incident ownership/SLA workflow fields
 * - incident evidence chain-of-custody metadata table
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function hasColumn(table, col) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, col]
  );
  return rows && rows.length > 0;
}

async function addColumnIfMissing(table, col, ddl) {
  if (await hasColumn(table, col)) return;
  await db.execute(ddl);
}

async function run() {
  // Auth hardening fields
  await addColumnIfMissing(
    'admin_users',
    'failed_login_attempts',
    `ALTER TABLE admin_users ADD COLUMN failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0 AFTER last_login_at`
  );
  await addColumnIfMissing(
    'admin_users',
    'locked_until',
    `ALTER TABLE admin_users ADD COLUMN locked_until DATETIME NULL AFTER failed_login_attempts`
  );
  await addColumnIfMissing(
    'admin_users',
    'password_changed_at',
    `ALTER TABLE admin_users ADD COLUMN password_changed_at DATETIME NULL AFTER locked_until`
  );
  await addColumnIfMissing(
    'admin_users',
    'mfa_enabled',
    `ALTER TABLE admin_users ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER password_changed_at`
  );
  await addColumnIfMissing(
    'admin_users',
    'mfa_secret',
    `ALTER TABLE admin_users ADD COLUMN mfa_secret VARCHAR(255) NULL AFTER mfa_enabled`
  );
  await addColumnIfMissing(
    'admin_users',
    'mfa_temp_secret',
    `ALTER TABLE admin_users ADD COLUMN mfa_temp_secret VARCHAR(255) NULL AFTER mfa_secret`
  );
  await addColumnIfMissing(
    'admin_users',
    'session_version',
    `ALTER TABLE admin_users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER mfa_temp_secret`
  );

  // Case workflow fields
  await addColumnIfMissing(
    'incidents',
    'owner_user_id',
    `ALTER TABLE incidents ADD COLUMN owner_user_id INT UNSIGNED NULL AFTER endpoint_id`
  );
  await addColumnIfMissing(
    'incidents',
    'owner_username',
    `ALTER TABLE incidents ADD COLUMN owner_username VARCHAR(128) NULL AFTER owner_user_id`
  );
  await addColumnIfMissing(
    'incidents',
    'sla_minutes',
    `ALTER TABLE incidents ADD COLUMN sla_minutes INT UNSIGNED NOT NULL DEFAULT 240 AFTER owner_username`
  );
  await addColumnIfMissing(
    'incidents',
    'due_at',
    `ALTER TABLE incidents ADD COLUMN due_at DATETIME NULL AFTER sla_minutes`
  );
  await addColumnIfMissing(
    'incidents',
    'first_ack_at',
    `ALTER TABLE incidents ADD COLUMN first_ack_at DATETIME NULL AFTER due_at`
  );
  await addColumnIfMissing(
    'incidents',
    'resolved_at',
    `ALTER TABLE incidents ADD COLUMN resolved_at DATETIME NULL AFTER first_ack_at`
  );
  await addColumnIfMissing(
    'incidents',
    'closed_at',
    `ALTER TABLE incidents ADD COLUMN closed_at DATETIME NULL AFTER resolved_at`
  );

  // Evidence chain-of-custody metadata
  await db.execute(
    `CREATE TABLE IF NOT EXISTS incident_evidence (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      incident_id INT UNSIGNED NOT NULL,
      evidence_type ENUM('file','log','memory_dump','network_capture','other') NOT NULL DEFAULT 'other',
      storage_uri VARCHAR(1024) NOT NULL,
      sha256 VARCHAR(64) NULL,
      size_bytes BIGINT UNSIGNED NULL,
      collected_by VARCHAR(128) NOT NULL,
      collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      custody_note VARCHAR(512) NULL,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      INDEX idx_incident_evidence_incident (incident_id, collected_at),
      INDEX idx_incident_evidence_sha (sha256)
    ) ENGINE=InnoDB`
  );

  console.log('OK: SOC hardening baseline');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

