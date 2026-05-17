/**
 * Core enterprise tables: RBAC (roles/permissions) and phase-6 notification/retention.
 * Idempotent — safe on DBs that already ran legacy schema-phase5/phase6 scripts.
 */
const { withConnection, tableExists } = require('../lib/migrationHelpers');

async function up() {
  await withConnection(async (conn, database) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        slug VARCHAR(64) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_slug (slug)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      INSERT IGNORE INTO tenants (id, name, slug, is_active)
      VALUES (1, 'Default', 'default', 1)
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(64) NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_role_name (name)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(64) NOT NULL UNIQUE,
        description TEXT,
        INDEX idx_perm_name (name)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT UNSIGNED NOT NULL,
        permission_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    if (await tableExists(conn, database, 'admin_users')) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id INT UNSIGNED NOT NULL,
          role_id INT UNSIGNED NOT NULL,
          tenant_id INT UNSIGNED,
          PRIMARY KEY (user_id, role_id),
          FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED,
        type ENUM('email', 'webhook', 'slack') NOT NULL,
        name VARCHAR(128),
        config JSON NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_channel_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED,
        name VARCHAR(128) NOT NULL,
        table_name VARCHAR(64) NOT NULL,
        retain_days INT UNSIGNED NOT NULL DEFAULT 90,
        archive_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        last_run_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_retention_tenant (tenant_id)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS agent_releases (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(64) NOT NULL,
        platform VARCHAR(32) NOT NULL DEFAULT 'windows',
        channel VARCHAR(32) NOT NULL DEFAULT 'stable',
        download_url VARCHAR(512),
        checksum_sha256 VARCHAR(64),
        signature TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_release_version_platform (version, platform),
        INDEX idx_release_channel (channel)
      ) ENGINE=InnoDB
    `);
  });
}

async function down() {
  /* Tables may be referenced — no destructive down */
}

module.exports = { up, down };
