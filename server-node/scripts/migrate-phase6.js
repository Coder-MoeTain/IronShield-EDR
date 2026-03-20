#!/usr/bin/env node
/**
 * Phase 6 migration - adds tenant_id, notification_channels, retention_policies, agent_releases
 * Run: node scripts/migrate-phase6.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'edr_platform',
};

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.database, table, column]
  );
  return rows.length > 0;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [config.database, table]
  );
  return rows.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  try {
    if (!(await tableExists(conn, 'tenants'))) {
      console.log('Run schema-phase5.sql first. Skipping Phase 6 migration.');
      process.exit(1);
    }

    if (!(await columnExists(conn, 'admin_users', 'tenant_id'))) {
      await conn.query('ALTER TABLE admin_users ADD COLUMN tenant_id INT UNSIGNED NULL');
      console.log('Added tenant_id to admin_users');
    }
    if (!(await columnExists(conn, 'endpoints', 'tenant_id'))) {
      await conn.query('ALTER TABLE endpoints ADD COLUMN tenant_id INT UNSIGNED NULL');
      console.log('Added tenant_id to endpoints');
    }
    if (!(await columnExists(conn, 'ioc_watchlist', 'tenant_id'))) {
      await conn.query('ALTER TABLE ioc_watchlist ADD COLUMN tenant_id INT UNSIGNED NULL');
      console.log('Added tenant_id to ioc_watchlist');
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
    console.log('Created notification_channels');

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
    console.log('Created retention_policies');

    await conn.query(`
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
        INDEX idx_net_last_seen (last_seen)
      ) ENGINE=InnoDB
    `);
    console.log('Created network_connections');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS agent_releases (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(32) NOT NULL UNIQUE,
        download_url VARCHAR(512),
        checksum_sha256 VARCHAR(64),
        release_notes TEXT,
        is_current BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_release_version (version)
      ) ENGINE=InnoDB
    `);
    console.log('Created agent_releases');

    const [tenants] = await conn.query('SELECT id FROM tenants LIMIT 1');
    if (tenants.length === 0) {
      await conn.query(
        "INSERT INTO tenants (name, slug) VALUES ('Default', 'default')"
      );
      console.log('Created default tenant');
    }

    console.log('Phase 6 migration complete');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
