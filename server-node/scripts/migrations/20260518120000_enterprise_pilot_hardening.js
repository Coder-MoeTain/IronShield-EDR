/**
 * Enterprise pilot hardening: durable nonces, alert evidence, incident workflow,
 * mTLS cert metadata, endpoint trust metrics, RTR policy columns, migration checksums.
 */
const {
  withConnection,
  addColumnIfMissing,
  addIndexIfMissing,
  tableExists,
} = require('../lib/migrationHelpers');

async function up() {
  await withConnection(async (conn, database) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS agent_request_nonces (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        endpoint_id INT UNSIGNED NOT NULL,
        nonce VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_agent_req_nonce (endpoint_id, nonce),
        INDEX idx_agent_req_nonce_expires (expires_at)
      ) ENGINE=InnoDB
    `);

    if (await tableExists(conn, database, 'agent_nonces')) {
      try {
        await conn.query(`
          INSERT IGNORE INTO agent_request_nonces (endpoint_id, nonce, expires_at, created_at)
          SELECT endpoint_id, nonce, expires_at, COALESCE(created_at, NOW()) FROM agent_nonces
        `);
      } catch {
        /* best-effort copy */
      }
    }

    await conn.query(`
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS incident_timeline (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        incident_id INT UNSIGNED NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        message TEXT NULL,
        actor VARCHAR(128) NULL,
        metadata_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_incident_timeline_incident (incident_id, created_at)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS incident_notes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        incident_id INT UNSIGNED NOT NULL,
        author VARCHAR(128) NULL,
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_incident_notes_incident (incident_id, created_at)
      ) ENGINE=InnoDB
    `);

    if (await tableExists(conn, database, 'incidents')) {
      await addColumnIfMissing(
        conn,
        database,
        'incidents',
        'tenant_id',
        'ALTER TABLE incidents ADD COLUMN tenant_id INT UNSIGNED NULL'
      );
      await addIndexIfMissing(
        conn,
        database,
        'incidents',
        'idx_incidents_tenant',
        'CREATE INDEX idx_incidents_tenant ON incidents (tenant_id)'
      );
      await addColumnIfMissing(
        conn,
        database,
        'incidents',
        'lifecycle_phase',
        "ALTER TABLE incidents ADD COLUMN lifecycle_phase VARCHAR(32) NOT NULL DEFAULT 'triage'"
      );
      try {
        await conn.query(`
          UPDATE incidents SET lifecycle_phase = CASE status
            WHEN 'open' THEN 'triage'
            WHEN 'investigating' THEN 'investigation'
            WHEN 'resolved' THEN 'recovery'
            WHEN 'closed' THEN 'closed'
            ELSE 'triage'
          END WHERE lifecycle_phase IS NULL OR lifecycle_phase = ''
        `);
      } catch {
        /* ignore */
      }
    }

    const certCols = [
      ['cert_fingerprint_sha256', 'ALTER TABLE endpoints ADD COLUMN cert_fingerprint_sha256 VARCHAR(64) NULL'],
      ['cert_issuer', 'ALTER TABLE endpoints ADD COLUMN cert_issuer VARCHAR(512) NULL'],
      ['cert_not_before', 'ALTER TABLE endpoints ADD COLUMN cert_not_before DATETIME NULL'],
      ['cert_not_after', 'ALTER TABLE endpoints ADD COLUMN cert_not_after DATETIME NULL'],
      ['cert_bound_at', 'ALTER TABLE endpoints ADD COLUMN cert_bound_at DATETIME NULL'],
    ];
    for (const [col, ddl] of certCols) {
      await addColumnIfMissing(conn, database, 'endpoints', col, ddl);
    }
    try {
      await conn.query(`
        UPDATE endpoints SET cert_fingerprint_sha256 = LOWER(cert_fingerprint)
        WHERE cert_fingerprint IS NOT NULL AND (cert_fingerprint_sha256 IS NULL OR cert_fingerprint_sha256 = '')
      `);
    } catch {
      /* ignore */
    }

    const trustCols = [
      ['last_replay_failure_at', 'ALTER TABLE endpoints ADD COLUMN last_replay_failure_at DATETIME NULL'],
      ['agent_auth_failure_count', 'ALTER TABLE endpoints ADD COLUMN agent_auth_failure_count INT UNSIGNED NOT NULL DEFAULT 0'],
      ['last_auth_failure_at', 'ALTER TABLE endpoints ADD COLUMN last_auth_failure_at DATETIME NULL'],
      ['tamper_status', 'ALTER TABLE endpoints ADD COLUMN tamper_status VARCHAR(32) NULL'],
      ['policy_version', 'ALTER TABLE endpoints ADD COLUMN policy_version VARCHAR(64) NULL'],
      ['rtr_allowed', 'ALTER TABLE endpoints ADD COLUMN rtr_allowed TINYINT(1) NOT NULL DEFAULT 0'],
    ];
    for (const [col, ddl] of trustCols) {
      await addColumnIfMissing(conn, database, 'endpoints', col, ddl);
    }

    if (await tableExists(conn, database, 'tenants')) {
      await addColumnIfMissing(
        conn,
        database,
        'tenants',
        'rtr_enabled',
        'ALTER TABLE tenants ADD COLUMN rtr_enabled TINYINT(1) NOT NULL DEFAULT 0'
      );
      await addColumnIfMissing(
        conn,
        database,
        'tenants',
        'rtr_emergency_disabled',
        'ALTER TABLE tenants ADD COLUMN rtr_emergency_disabled TINYINT(1) NOT NULL DEFAULT 0'
      );
    }

    if (await tableExists(conn, database, 'schema_migrations')) {
      await addColumnIfMissing(
        conn,
        database,
        'schema_migrations',
        'checksum',
        'ALTER TABLE schema_migrations ADD COLUMN checksum VARCHAR(64) NULL'
      );
      await addColumnIfMissing(
        conn,
        database,
        'schema_migrations',
        'status',
        "ALTER TABLE schema_migrations ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'applied'"
      );
    }

    if (await tableExists(conn, database, 'rtr_sessions')) {
      await addColumnIfMissing(
        conn,
        database,
        'rtr_sessions',
        'expires_at',
        'ALTER TABLE rtr_sessions ADD COLUMN expires_at DATETIME NULL'
      );
      await addColumnIfMissing(
        conn,
        database,
        'rtr_sessions',
        'transcript_json',
        'ALTER TABLE rtr_sessions ADD COLUMN transcript_json JSON NULL'
      );
    }
    if (await tableExists(conn, database, 'rtr_session_commands')) {
      await addColumnIfMissing(
        conn,
        database,
        'rtr_session_commands',
        'approval_status',
        "ALTER TABLE rtr_session_commands ADD COLUMN approval_status VARCHAR(24) NULL DEFAULT 'auto'"
      );
      await addColumnIfMissing(
        conn,
        database,
        'rtr_session_commands',
        'output_truncated',
        'ALTER TABLE rtr_session_commands ADD COLUMN output_truncated TINYINT(1) NOT NULL DEFAULT 0'
      );
    }
  });
}

async function down() {
  await withConnection(async (conn) => {
    const drops = [
      'DROP TABLE IF EXISTS incident_notes',
      'DROP TABLE IF EXISTS incident_timeline',
      'DROP TABLE IF EXISTS alert_evidence',
      'DROP TABLE IF EXISTS agent_request_nonces',
    ];
    for (const sql of drops) {
      try {
        await conn.query(sql);
      } catch {
        /* ignore */
      }
    }
  });
}

module.exports = { up, down };
