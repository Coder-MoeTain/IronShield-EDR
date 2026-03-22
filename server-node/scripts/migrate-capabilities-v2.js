#!/usr/bin/env node
/**
 * Suppression rules + response playbooks + process timeline support (uses existing tables).
 * Run: node scripts/migrate-capabilities-v2.js
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

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [config.database, table]
  );
  return rows.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS detection_suppressions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED NULL,
        rule_id INT UNSIGNED NULL,
        endpoint_id INT UNSIGNED NULL,
        hostname_pattern VARCHAR(255) NULL,
        process_path_pattern VARCHAR(512) NULL,
        title_contains VARCHAR(255) NULL,
        comment VARCHAR(512) NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        expires_at DATETIME NULL,
        created_by VARCHAR(128) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ds_tenant (tenant_id),
        INDEX idx_ds_rule (rule_id),
        INDEX idx_ds_endpoint (endpoint_id),
        INDEX idx_ds_enabled (enabled)
      ) ENGINE=InnoDB
    `);
    console.log('detection_suppressions OK');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS response_playbooks (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED NULL,
        name VARCHAR(128) NOT NULL,
        description VARCHAR(512) NULL,
        steps_json JSON NOT NULL,
        created_by VARCHAR(128) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pb_tenant (tenant_id),
        INDEX idx_pb_name (name)
      ) ENGINE=InnoDB
    `);
    console.log('response_playbooks OK');

    console.log('migrate-capabilities-v2 done.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
