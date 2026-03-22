#!/usr/bin/env node
/**
 * Phase 5 — tenants table + endpoints.tenant_id (Falcon-style multi-tenant enrollment).
 * Run: cd server-node && npm run migrate-phase5-endpoints-tenant
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
    console.log('tenants table OK');

    const [countRows] = await conn.query('SELECT COUNT(*) AS n FROM tenants');
    if (countRows[0].n === 0) {
      await conn.query(
        "INSERT INTO tenants (name, slug, is_active) VALUES ('Default', 'default', TRUE)"
      );
      console.log('Seeded default tenant (slug=default)');
    }

    if (!(await columnExists(conn, 'endpoints', 'tenant_id'))) {
      await conn.query(
        'ALTER TABLE endpoints ADD COLUMN tenant_id INT UNSIGNED NULL AFTER agent_key'
      );
      console.log('Added endpoints.tenant_id');
      const [defRows] = await conn.query(
        "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
      );
      if (defRows[0]?.id) {
        await conn.query('UPDATE endpoints SET tenant_id = ? WHERE tenant_id IS NULL', [defRows[0].id]);
        console.log('Backfilled tenant_id for existing endpoints');
      }
      try {
        await conn.query(`
          ALTER TABLE endpoints
          ADD CONSTRAINT fk_endpoints_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
        `);
        console.log('Added FK fk_endpoints_tenant');
      } catch (e) {
        console.warn('FK fk_endpoints_tenant skipped:', e.message);
      }
    } else {
      console.log('endpoints.tenant_id already present');
    }

    console.log('migrate-phase5-endpoints-tenant complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
