#!/usr/bin/env node
/**
 * Migration - add tenant_id to detection_rules for enterprise multi-tenant support
 * Run: node scripts/migrate-detection-rules-tenant.js
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
      console.log('Run schema-phase5.sql first. Skipping migration.');
      process.exit(1);
    }
    if (!(await tableExists(conn, 'detection_rules'))) {
      console.log('detection_rules table not found. Skipping.');
      process.exit(0);
    }
    if (await columnExists(conn, 'detection_rules', 'tenant_id')) {
      console.log('tenant_id already exists on detection_rules. Done.');
      process.exit(0);
    }

    await conn.query('ALTER TABLE detection_rules ADD COLUMN tenant_id INT UNSIGNED NULL AFTER id');
    console.log('Added tenant_id to detection_rules');

    await conn.query('ALTER TABLE detection_rules ADD INDEX idx_detection_rules_tenant (tenant_id)');
    console.log('Added index idx_detection_rules_tenant');

    try {
      await conn.query(
        'ALTER TABLE detection_rules ADD CONSTRAINT fk_detection_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE'
      );
      console.log('Added FK to tenants');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME' || e.message?.includes('Duplicate')) {
        console.log('FK may already exist, skipping');
      } else throw e;
    }

    console.log('Migration complete.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
