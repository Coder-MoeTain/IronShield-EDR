#!/usr/bin/env node
/**
 * Host groups + endpoints.host_group_id (CrowdStrike-class sensor grouping).
 * Run: node scripts/migrate-cs-parity.js
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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS host_groups (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT UNSIGNED NULL,
        name VARCHAR(128) NOT NULL,
        description VARCHAR(512) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_host_groups_tenant (tenant_id),
        INDEX idx_host_groups_name (name)
      ) ENGINE=InnoDB
    `);
    console.log('host_groups table OK');

    if (!(await columnExists(conn, 'endpoints', 'host_group_id'))) {
      await conn.query('ALTER TABLE endpoints ADD COLUMN host_group_id INT UNSIGNED NULL AFTER policy_status');
      console.log('Added endpoints.host_group_id');
    } else {
      console.log('endpoints.host_group_id already present');
    }

    if ((await tableExists(conn, 'host_groups')) && (await columnExists(conn, 'endpoints', 'host_group_id'))) {
      const [fk] = await conn.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'endpoints' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
           AND CONSTRAINT_NAME = 'fk_endpoints_host_group'`,
        [config.database]
      );
      if (!fk.length) {
        try {
          await conn.query(`
            ALTER TABLE endpoints
            ADD CONSTRAINT fk_endpoints_host_group
            FOREIGN KEY (host_group_id) REFERENCES host_groups(id) ON DELETE SET NULL
          `);
          console.log('Added FK fk_endpoints_host_group');
        } catch (e) {
          console.warn('FK fk_endpoints_host_group skipped:', e.message);
        }
      }
    }

    console.log('migrate-cs-parity done.');
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
