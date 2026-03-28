#!/usr/bin/env node
/**
 * User-mode tamper / integrity snapshot from agent heartbeats (JSON on endpoints).
 * Run: cd server-node && npm run migrate-tamper-signals
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
    if (!(await columnExists(conn, 'endpoints', 'tamper_signals_json'))) {
      await conn.query('ALTER TABLE endpoints ADD COLUMN tamper_signals_json JSON NULL');
      console.log('Added endpoints.tamper_signals_json');
    } else {
      console.log('endpoints.tamper_signals_json already present');
    }
    console.log('Tamper signals migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
