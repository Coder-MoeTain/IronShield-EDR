/**
 * Software Risk Management: inventory, vulnerabilities, remediation, block policies.
 */
const { withConnection } = require('../lib/migrationHelpers');

async function up() {
  await withConnection(async (conn) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS software_catalog (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        normalized_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(512) NOT NULL,
        vendor VARCHAR(255) NULL,
        product_family VARCHAR(128) NULL,
        category VARCHAR(128) NULL,
        homepage_url VARCHAR(512) NULL,
        known_safe TINYINT(1) NOT NULL DEFAULT 0,
        known_risky TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_software_catalog_norm (normalized_name),
        KEY idx_software_catalog_vendor (vendor)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS endpoint_software_inventory (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NOT NULL,
        endpoint_id BIGINT UNSIGNED NOT NULL,
        software_catalog_id BIGINT UNSIGNED NULL,
        fingerprint VARCHAR(64) NOT NULL,
        name VARCHAR(512) NOT NULL,
        normalized_name VARCHAR(255) NOT NULL,
        vendor VARCHAR(255) NULL,
        normalized_vendor VARCHAR(255) NULL,
        version VARCHAR(128) NULL,
        install_location TEXT NULL,
        executable_paths JSON NULL,
        uninstall_string TEXT NULL,
        quiet_uninstall_string TEXT NULL,
        install_date DATE NULL,
        architecture VARCHAR(16) NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'registry',
        first_seen_at DATETIME NOT NULL,
        last_seen_at DATETIME NOT NULL,
        removed_at DATETIME NULL,
        status ENUM('installed','removed','unknown') NOT NULL DEFAULT 'installed',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_esw_tenant_ep_fp (tenant_id, endpoint_id, fingerprint),
        KEY idx_esw_tenant (tenant_id),
        KEY idx_esw_endpoint (endpoint_id),
        KEY idx_esw_norm_name (normalized_name),
        KEY idx_esw_norm_vendor (normalized_vendor),
        KEY idx_esw_version (version),
        KEY idx_esw_last_seen (last_seen_at),
        KEY idx_esw_status (status)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS software_vulnerabilities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        software_catalog_id BIGINT UNSIGNED NULL,
        normalized_name VARCHAR(255) NOT NULL,
        vendor VARCHAR(255) NULL,
        affected_version_expression VARCHAR(256) NOT NULL,
        fixed_version VARCHAR(128) NULL,
        cve_id VARCHAR(32) NOT NULL,
        cve_title VARCHAR(512) NULL,
        severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
        cvss_score DECIMAL(3,1) NULL,
        epss_score DECIMAL(5,4) NULL,
        exploit_known TINYINT(1) NOT NULL DEFAULT 0,
        ransomware_used TINYINT(1) NOT NULL DEFAULT 0,
        description TEXT NULL,
        remediation TEXT NULL,
        source VARCHAR(64) NOT NULL DEFAULT 'manual',
        published_at DATETIME NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sv_norm_name (normalized_name),
        KEY idx_sv_cve (cve_id),
        KEY idx_sv_severity (severity)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS endpoint_software_risk (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NOT NULL,
        endpoint_id BIGINT UNSIGNED NOT NULL,
        software_inventory_id BIGINT UNSIGNED NOT NULL,
        risk_score INT NOT NULL DEFAULT 0,
        risk_level ENUM('none','low','medium','high','critical') NOT NULL DEFAULT 'none',
        vulnerability_count INT NOT NULL DEFAULT 0,
        critical_count INT NOT NULL DEFAULT 0,
        high_count INT NOT NULL DEFAULT 0,
        known_exploit_count INT NOT NULL DEFAULT 0,
        outdated TINYINT(1) NOT NULL DEFAULT 0,
        unsupported TINYINT(1) NOT NULL DEFAULT 0,
        blocked TINYINT(1) NOT NULL DEFAULT 0,
        accepted_risk TINYINT(1) NOT NULL DEFAULT 0,
        accepted_risk_until DATETIME NULL,
        recommended_action ENUM('none','update','uninstall','block','accept_risk') NOT NULL DEFAULT 'none',
        reason TEXT NULL,
        risk_factors_json JSON NULL,
        calculated_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_esr_inventory (software_inventory_id),
        KEY idx_esr_tenant (tenant_id),
        KEY idx_esr_endpoint (endpoint_id),
        KEY idx_esr_risk_score (risk_score),
        KEY idx_esr_risk_level (risk_level)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS software_remediation_actions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NOT NULL,
        endpoint_id BIGINT UNSIGNED NOT NULL,
        software_inventory_id BIGINT UNSIGNED NOT NULL,
        action_type ENUM('notify_update','notify_uninstall','block_execution','unblock_execution','accept_risk','refresh_inventory') NOT NULL,
        status ENUM('requested','pending_agent','delivered','acknowledged','completed','failed','cancelled','expired') NOT NULL DEFAULT 'requested',
        message_title VARCHAR(256) NULL,
        message_body TEXT NULL,
        requested_by VARCHAR(128) NULL,
        approved_by VARCHAR(128) NULL,
        requires_approval TINYINT(1) NOT NULL DEFAULT 0,
        expires_at DATETIME NULL,
        result JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_sra_tenant (tenant_id),
        KEY idx_sra_endpoint (endpoint_id),
        KEY idx_sra_status (status),
        KEY idx_sra_inventory (software_inventory_id)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS software_block_policies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(256) NOT NULL,
        description TEXT NULL,
        software_name VARCHAR(512) NOT NULL,
        vendor VARCHAR(255) NULL,
        version_expression VARCHAR(256) NULL,
        executable_path_pattern VARCHAR(512) NULL,
        file_hash VARCHAR(128) NULL,
        action ENUM('block','warn','audit_only') NOT NULL DEFAULT 'block',
        user_message_title VARCHAR(256) NULL,
        user_message_body TEXT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        expires_at DATETIME NULL,
        created_by VARCHAR(128) NULL,
        approved_by VARCHAR(128) NULL,
        requires_approval TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_sbp_tenant (tenant_id),
        KEY idx_sbp_enabled (enabled)
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS software_user_notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id BIGINT UNSIGNED NOT NULL,
        endpoint_id BIGINT UNSIGNED NOT NULL,
        software_inventory_id BIGINT UNSIGNED NULL,
        remediation_action_id BIGINT UNSIGNED NULL,
        title VARCHAR(256) NOT NULL,
        message TEXT NOT NULL,
        severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
        status ENUM('pending','sent','shown','acknowledged','failed','expired') NOT NULL DEFAULT 'pending',
        user_response VARCHAR(64) NULL,
        shown_at DATETIME NULL,
        acknowledged_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_sun_tenant (tenant_id),
        KEY idx_sun_endpoint (endpoint_id),
        KEY idx_sun_status (status)
      ) ENGINE=InnoDB
    `);

    const softwarePerms = [
      'software:view',
      'software:manage',
      'software:vulnerability:manage',
      'software:notify',
      'software:block',
      'software:unblock',
      'software:accept_risk',
      'software:export',
      'software:policy:manage',
    ];
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions'`
    );
    if (tables.length) {
      for (const name of softwarePerms) {
        await conn.query('INSERT IGNORE INTO permissions (name) VALUES (?)', [name]);
      }
      const roleMap = {
        tenant_admin: softwarePerms,
        soc_manager: ['software:view', 'software:notify', 'software:block', 'software:unblock', 'software:accept_risk', 'software:export'],
        senior_analyst: ['software:view', 'software:notify', 'software:block'],
        analyst: ['software:view', 'software:notify'],
        read_only: ['software:view'],
        auditor: ['software:view', 'software:export'],
      };
      for (const [roleName, perms] of Object.entries(roleMap)) {
        const [roles] = await conn.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [roleName]);
        const roleId = roles[0]?.id;
        if (!roleId) continue;
        for (const perm of perms) {
          const [prows] = await conn.query('SELECT id FROM permissions WHERE name = ? LIMIT 1', [perm]);
          const permId = prows[0]?.id;
          if (permId) {
            await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
              roleId,
              permId,
            ]);
          }
        }
      }
    }
  });
}

async function down() {
  await withConnection(async (conn) => {
    const tables = [
      'software_user_notifications',
      'software_remediation_actions',
      'software_block_policies',
      'endpoint_software_risk',
      'software_vulnerabilities',
      'endpoint_software_inventory',
      'software_catalog',
    ];
    for (const t of tables) {
      await conn.query(`DROP TABLE IF EXISTS ${t}`);
    }
  });
}

module.exports = { up, down };
