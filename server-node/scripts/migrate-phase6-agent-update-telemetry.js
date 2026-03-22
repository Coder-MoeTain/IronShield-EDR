#!/usr/bin/env node
/**
 * Phase 6 — Agent / sensor update telemetry on endpoints (Falcon-style pending update visibility).
 * Run: cd server-node && npm run migrate-phase6-agent-update-telemetry
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
      ['agent_update_status', 'VARCHAR(24) NULL'],
      ['available_agent_version', 'VARCHAR(32) NULL'],
      ['last_agent_update_check_at', 'DATETIME NULL'],
    ];
    for (const [name, def] of cols) {
      if (!(await columnExists(conn, 'endpoints', name))) {
        await conn.query(`ALTER TABLE endpoints ADD COLUMN ${name} ${def}`);
        console.log('Added endpoints.' + name);
      }
    }
    console.log('Phase 6 agent update telemetry migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
