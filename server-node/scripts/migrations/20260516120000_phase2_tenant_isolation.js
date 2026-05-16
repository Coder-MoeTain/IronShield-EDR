/**
 * Phase 2 — tenant columns on telemetry/alert tables + agent/script/rule tables.
 */
const {
  withConnection,
  columnExists,
  addColumnIfMissing,
  addIndexIfMissing,
  ensureDefaultTenant,
  tableExists,
} = require('../lib/migrationHelpers');

async function addTenantColumn(conn, database, table) {
  const added = await addColumnIfMissing(
    conn,
    database,
    table,
    'tenant_id',
    `ALTER TABLE ${table} ADD COLUMN tenant_id INT UNSIGNED NULL AFTER id`
  );
  if (added) {
    await conn.query(`
      UPDATE ${table} t
      INNER JOIN endpoints e ON e.id = t.endpoint_id
      SET t.tenant_id = e.tenant_id
      WHERE t.tenant_id IS NULL AND t.endpoint_id IS NOT NULL
    `);
  }
  await addIndexIfMissing(
    conn,
    database,
    table,
    `idx_${table}_tenant`,
    `CREATE INDEX idx_${table}_tenant ON ${table}(tenant_id)`
  );
}

async function up() {
  await withConnection(async (conn, database) => {
    await ensureDefaultTenant(conn);

    if (!(await columnExists(conn, database, 'endpoints', 'tenant_id'))) {
      await conn.query(
        'ALTER TABLE endpoints ADD COLUMN tenant_id INT UNSIGNED NULL AFTER agent_key'
      );
      const defaultTenantId = await ensureDefaultTenant(conn);
      if (defaultTenantId) {
        await conn.query('UPDATE endpoints SET tenant_id = ? WHERE tenant_id IS NULL', [
          defaultTenantId,
        ]);
      }
    }

    for (const table of ['raw_events', 'normalized_events', 'alerts']) {
      if (await tableExists(conn, database, table)) {
        if (table === 'alerts') {
          const added = await addColumnIfMissing(
            conn,
            database,
            'alerts',
            'tenant_id',
            'ALTER TABLE alerts ADD COLUMN tenant_id INT UNSIGNED NULL AFTER id'
          );
          if (added) {
            await conn.query(`
              UPDATE alerts a
              INNER JOIN endpoints e ON e.id = a.endpoint_id
              SET a.tenant_id = e.tenant_id
              WHERE a.tenant_id IS NULL
            `);
          }
          await addIndexIfMissing(
            conn,
            database,
            'alerts',
            'idx_alerts_tenant',
            'CREATE INDEX idx_alerts_tenant ON alerts(tenant_id)'
          );
        } else {
          await addTenantColumn(conn, database, table);
        }
      }
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS agent_nonces (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        endpoint_id INT UNSIGNED NOT NULL,
        nonce VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_endpoint_nonce (endpoint_id, nonce),
        INDEX idx_agent_nonces_expires (expires_at),
        CONSTRAINT fk_agent_nonces_endpoint
          FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS approved_scripts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        sha256 CHAR(64) NOT NULL,
        path_prefix VARCHAR(512) NULL,
        version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_by VARCHAR(128) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tenant_script_sha (tenant_id, sha256),
        INDEX idx_approved_scripts_tenant (tenant_id, enabled),
        CONSTRAINT fk_approved_scripts_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS detection_rule_versions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rule_id INT UNSIGNED NOT NULL,
        tenant_id INT UNSIGNED NULL,
        version VARCHAR(32) NOT NULL,
        definition_json JSON NOT NULL,
        created_by VARCHAR(128) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_drv_rule (rule_id, version),
        INDEX idx_drv_tenant (tenant_id),
        CONSTRAINT fk_drv_rule
          FOREIGN KEY (rule_id) REFERENCES detection_rules(id) ON DELETE CASCADE,
        CONSTRAINT fk_drv_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  });
}

async function down() {
  await withConnection(async (conn, database) => {
    await conn.query('DROP TABLE IF EXISTS detection_rule_versions');
    await conn.query('DROP TABLE IF EXISTS approved_scripts');
    await conn.query('DROP TABLE IF EXISTS agent_nonces');

    for (const table of ['alerts', 'normalized_events', 'raw_events']) {
      if (await tableExists(conn, database, table)) {
        if (await columnExists(conn, database, table, 'tenant_id')) {
          try {
            await conn.query(`ALTER TABLE ${table} DROP INDEX idx_${table}_tenant`);
          } catch {
            try {
              await conn.query(`ALTER TABLE ${table} DROP INDEX idx_alerts_tenant`);
            } catch {
              /* index name may differ */
            }
          }
          await conn.query(`ALTER TABLE ${table} DROP COLUMN tenant_id`);
        }
      }
    }
  });
}

module.exports = { up, down };
