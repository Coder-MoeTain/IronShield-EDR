#!/usr/bin/env node
/**
 * Adds DNS / registry / image-load columns on normalized_events (parity with migrate-parity-phases.sql).
 * Idempotent. Run: cd server-node && npm run migrate-normalized-events-parity
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

async function columnExists(conn, table, col) {
  const [r] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [config.database, table, col]
  );
  return r.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  try {
    const cols = [
      ['dns_query', 'VARCHAR(512) NULL'],
      ['dns_query_type', 'VARCHAR(32) NULL'],
      ['registry_key', 'VARCHAR(1024) NULL'],
      ['registry_value_name', 'VARCHAR(256) NULL'],
      ['image_loaded_path', 'VARCHAR(1024) NULL'],
    ];
    for (const [name, def] of cols) {
      if (!(await columnExists(conn, 'normalized_events', name))) {
        await conn.query(`ALTER TABLE normalized_events ADD COLUMN ${name} ${def}`);
        console.log('Added normalized_events.' + name);
      }
    }
    console.log('migrate-normalized-events-parity complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
