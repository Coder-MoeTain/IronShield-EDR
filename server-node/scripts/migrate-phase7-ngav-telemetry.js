#!/usr/bin/env node
/**
 * Phase 7 — NGAV / Malware prevention telemetry columns on av_update_status.
 * Run: cd server-node && npm run migrate-phase7-ngav-telemetry
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

async function tableExists(conn, table) {
  const [r] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
    [config.database, table]
  );
  return r.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  try {
    if (!(await tableExists(conn, 'av_update_status'))) {
      console.log('av_update_status missing — apply database/schema-antivirus.sql first');
      process.exit(0);
    }
    for (const [name, def] of [
      ['realtime_enabled', 'TINYINT(1) NULL'],
      ['prevention_status', 'VARCHAR(24) NULL'],
      ['signature_count', 'INT UNSIGNED NULL'],
    ]) {
      if (!(await columnExists(conn, 'av_update_status', name))) {
        await conn.query(`ALTER TABLE av_update_status ADD COLUMN ${name} ${def}`);
        console.log('Added av_update_status.' + name);
      }
    }
    console.log('migrate-phase7-ngav-telemetry complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
