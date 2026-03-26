/**
 * Migration: ensure policy-assignment and network tables exist for agent/runtime APIs.
 * Safe/idempotent for existing databases without dropping data.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function hasTable(name) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [name]
  );
  return rows && rows.length > 0;
}

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
  // Ensure endpoint_policies is the Phase 3 shape (add missing columns if table already exists).
  if (!(await hasTable('endpoint_policies'))) {
    await db.execute(`
      CREATE TABLE endpoint_policies (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL UNIQUE,
        mode ENUM('monitor_only', 'monitor_and_alert', 'restricted_response', 'full_response', 'high_sensitivity', 'server_policy', 'workstation_policy') NOT NULL DEFAULT 'monitor_and_alert',
        description TEXT,
        telemetry_interval_seconds INT UNSIGNED NOT NULL DEFAULT 30,
        batch_upload_size INT UNSIGNED NOT NULL DEFAULT 100,
        heartbeat_interval_minutes INT UNSIGNED NOT NULL DEFAULT 5,
        poll_interval_seconds INT UNSIGNED NOT NULL DEFAULT 60,
        allowed_response_actions JSON,
        allowed_triage_modules JSON,
        detection_sensitivity ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
        isolation_behavior ENUM('log_only', 'soft_block', 'full_isolation') NOT NULL DEFAULT 'log_only',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_policy_mode (mode),
        INDEX idx_policy_default (is_default)
      ) ENGINE=InnoDB
    `);
  } else {
    await addColumnIfMissing('endpoint_policies', 'name', `ALTER TABLE endpoint_policies ADD COLUMN name VARCHAR(128) NULL AFTER id`);
    await addColumnIfMissing('endpoint_policies', 'mode', `ALTER TABLE endpoint_policies ADD COLUMN mode VARCHAR(32) NOT NULL DEFAULT 'monitor_and_alert' AFTER name`);
    await addColumnIfMissing('endpoint_policies', 'description', `ALTER TABLE endpoint_policies ADD COLUMN description TEXT NULL AFTER mode`);
    await addColumnIfMissing('endpoint_policies', 'telemetry_interval_seconds', `ALTER TABLE endpoint_policies ADD COLUMN telemetry_interval_seconds INT UNSIGNED NOT NULL DEFAULT 30 AFTER description`);
    await addColumnIfMissing('endpoint_policies', 'batch_upload_size', `ALTER TABLE endpoint_policies ADD COLUMN batch_upload_size INT UNSIGNED NOT NULL DEFAULT 100 AFTER telemetry_interval_seconds`);
    await addColumnIfMissing('endpoint_policies', 'heartbeat_interval_minutes', `ALTER TABLE endpoint_policies ADD COLUMN heartbeat_interval_minutes INT UNSIGNED NOT NULL DEFAULT 5 AFTER batch_upload_size`);
    await addColumnIfMissing('endpoint_policies', 'poll_interval_seconds', `ALTER TABLE endpoint_policies ADD COLUMN poll_interval_seconds INT UNSIGNED NOT NULL DEFAULT 60 AFTER heartbeat_interval_minutes`);
    await addColumnIfMissing('endpoint_policies', 'allowed_response_actions', `ALTER TABLE endpoint_policies ADD COLUMN allowed_response_actions JSON NULL AFTER poll_interval_seconds`);
    await addColumnIfMissing('endpoint_policies', 'allowed_triage_modules', `ALTER TABLE endpoint_policies ADD COLUMN allowed_triage_modules JSON NULL AFTER allowed_response_actions`);
    await addColumnIfMissing('endpoint_policies', 'detection_sensitivity', `ALTER TABLE endpoint_policies ADD COLUMN detection_sensitivity VARCHAR(16) NOT NULL DEFAULT 'medium' AFTER allowed_triage_modules`);
    await addColumnIfMissing('endpoint_policies', 'isolation_behavior', `ALTER TABLE endpoint_policies ADD COLUMN isolation_behavior VARCHAR(16) NOT NULL DEFAULT 'log_only' AFTER detection_sensitivity`);
    await addColumnIfMissing('endpoint_policies', 'is_default', `ALTER TABLE endpoint_policies ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER isolation_behavior`);
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS endpoint_policy_assignments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      endpoint_id INT UNSIGNED NOT NULL,
      policy_id INT UNSIGNED NOT NULL,
      assigned_by VARCHAR(128),
      assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_endpoint_policy (endpoint_id),
      INDEX idx_assignment_policy (policy_id),
      CONSTRAINT fk_epa_endpoint FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
      CONSTRAINT fk_epa_policy FOREIGN KEY (policy_id) REFERENCES endpoint_policies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS endpoint_policy_history (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      endpoint_id INT UNSIGNED NOT NULL,
      policy_id INT UNSIGNED NULL,
      previous_policy_id INT UNSIGNED NULL,
      changed_by VARCHAR(128),
      reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_history_endpoint (endpoint_id),
      INDEX idx_history_created (created_at),
      CONSTRAINT fk_eph_endpoint FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS network_connections (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      endpoint_id INT UNSIGNED NOT NULL,
      local_address VARCHAR(45),
      local_port INT UNSIGNED,
      remote_address VARCHAR(45) NOT NULL,
      remote_port INT UNSIGNED NOT NULL,
      protocol VARCHAR(16) DEFAULT 'TCP',
      state VARCHAR(32),
      process_id INT UNSIGNED,
      process_name VARCHAR(512),
      process_path VARCHAR(1024),
      first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_net_endpoint (endpoint_id),
      INDEX idx_net_remote (remote_address),
      INDEX idx_net_last_seen (last_seen),
      CONSTRAINT fk_net_endpoint FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // If endpoint_policies is legacy schema (includes endpoint_id FK), avoid inserting default catalog rows.
  const legacyPerEndpointPolicy = await hasColumn('endpoint_policies', 'endpoint_id');
  if (!legacyPerEndpointPolicy) {
    const defaultPolicy = await db.queryOne('SELECT id FROM endpoint_policies WHERE is_default = 1 LIMIT 1');
    if (!defaultPolicy) {
      await db.execute(
        `INSERT INTO endpoint_policies
          (name, mode, description, telemetry_interval_seconds, batch_upload_size, heartbeat_interval_minutes, poll_interval_seconds, allowed_response_actions, allowed_triage_modules, detection_sensitivity, isolation_behavior, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          'Default Workstation',
          'monitor_and_alert',
          'Baseline endpoint policy',
          30,
          100,
          5,
          60,
          JSON.stringify(['request_heartbeat']),
          JSON.stringify(['processes', 'services', 'startup']),
          'medium',
          'log_only',
        ]
      );
    }

    await db.execute(
      `INSERT INTO endpoint_policy_assignments (endpoint_id, policy_id, assigned_by)
       SELECT e.id, p.id, 'system-migration'
       FROM endpoints e
       JOIN endpoint_policies p ON p.is_default = 1
       LEFT JOIN endpoint_policy_assignments a ON a.endpoint_id = e.id
       WHERE a.endpoint_id IS NULL`
    );
  } else {
    // Legacy schema: endpoint_policies rows are per-endpoint (endpoint_id FK).
    // Normalize minimal fields and bridge into assignment table.
    await db.execute(
      `UPDATE endpoint_policies
       SET name = COALESCE(name, CONCAT('Legacy Policy #', id)),
           mode = COALESCE(NULLIF(mode, ''), 'monitor_and_alert'),
           telemetry_interval_seconds = COALESCE(telemetry_interval_seconds, 30),
           batch_upload_size = COALESCE(batch_upload_size, 100),
           heartbeat_interval_minutes = COALESCE(heartbeat_interval_minutes, 5),
           poll_interval_seconds = COALESCE(poll_interval_seconds, 60),
           detection_sensitivity = COALESCE(NULLIF(detection_sensitivity, ''), 'medium'),
           isolation_behavior = COALESCE(NULLIF(isolation_behavior, ''), 'log_only')`
    );
    const one = await db.queryOne('SELECT id FROM endpoint_policies ORDER BY id ASC LIMIT 1');
    if (one?.id) {
      await db.execute('UPDATE endpoint_policies SET is_default = 0');
      await db.execute('UPDATE endpoint_policies SET is_default = 1 WHERE id = ?', [one.id]);
    }
    await db.execute(
      `INSERT INTO endpoint_policy_assignments (endpoint_id, policy_id, assigned_by)
       SELECT p.endpoint_id, p.id, 'legacy-migration'
       FROM endpoint_policies p
       LEFT JOIN endpoint_policy_assignments a ON a.endpoint_id = p.endpoint_id
       WHERE p.endpoint_id IS NOT NULL AND a.endpoint_id IS NULL`
    );
  }

  console.log('OK: policy/network baseline');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

