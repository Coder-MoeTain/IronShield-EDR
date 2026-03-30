#!/usr/bin/env node
/**
 * AV policy: ransomware protection toggle (agent classification + server alerts).
 * Run: cd server-node && npm run migrate-av-ransomware-protection
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
    if (!(await columnExists(conn, 'av_scan_policies', 'ransomware_protection_enabled'))) {
      await conn.query(
        'ALTER TABLE av_scan_policies ADD COLUMN ransomware_protection_enabled BOOLEAN NOT NULL DEFAULT TRUE'
      );
      console.log('Added av_scan_policies.ransomware_protection_enabled');
    } else {
      console.log('av_scan_policies.ransomware_protection_enabled already present');
    }
    console.log('AV ransomware protection migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
