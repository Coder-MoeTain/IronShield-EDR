#!/usr/bin/env node
/**
 * AV policy: configurable realtime scan debounce (seconds) for agent FileSystemWatcher noise control.
 * Run: cd server-node && npm run migrate-av-realtime-debounce
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
    if (!(await columnExists(conn, 'av_scan_policies', 'realtime_debounce_seconds'))) {
      await conn.query(
        'ALTER TABLE av_scan_policies ADD COLUMN realtime_debounce_seconds INT UNSIGNED NOT NULL DEFAULT 2'
      );
      console.log('Added av_scan_policies.realtime_debounce_seconds');
    } else {
      console.log('av_scan_policies.realtime_debounce_seconds already present');
    }
    console.log('AV realtime debounce migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
