#!/usr/bin/env node
/**
 * AV policy: USB / removable device control (agent WMI watcher + optional eject).
 * Run: cd server-node && npm run migrate-av-device-control
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
    if (!(await columnExists(conn, 'av_scan_policies', 'device_control_enabled'))) {
      await conn.query(
        'ALTER TABLE av_scan_policies ADD COLUMN device_control_enabled BOOLEAN NOT NULL DEFAULT FALSE'
      );
      console.log('Added av_scan_policies.device_control_enabled');
    } else {
      console.log('av_scan_policies.device_control_enabled already present');
    }
    if (!(await columnExists(conn, 'av_scan_policies', 'removable_storage_action'))) {
      await conn.query(
        "ALTER TABLE av_scan_policies ADD COLUMN removable_storage_action VARCHAR(16) NOT NULL DEFAULT 'audit'"
      );
      console.log('Added av_scan_policies.removable_storage_action');
    } else {
      console.log('av_scan_policies.removable_storage_action already present');
    }
    console.log('AV device control migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
