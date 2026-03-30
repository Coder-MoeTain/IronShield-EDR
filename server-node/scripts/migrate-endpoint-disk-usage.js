#!/usr/bin/env node
/**
 * Endpoint disk usage inventory from agent heartbeats (JSON).
 * Run from server-node: npm run migrate-endpoint-disk-usage
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
    if (!(await columnExists(conn, 'endpoints', 'host_disk_usage_json'))) {
      await conn.query('ALTER TABLE endpoints ADD COLUMN host_disk_usage_json JSON NULL');
      console.log('Added endpoints.host_disk_usage_json');
    }
    console.log('Endpoint disk usage migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
