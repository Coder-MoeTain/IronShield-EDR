#!/usr/bin/env node
/**
 * Host inventory from agent heartbeats: listening ports + SMB shares (JSON).
 * Run from server-node: npm run migrate-endpoint-host-inventory
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
      ['host_listening_ports_json', 'JSON NULL'],
      ['host_shared_folders_json', 'JSON NULL'],
      ['host_inventory_at', 'DATETIME NULL'],
    ];
    for (const [name, def] of cols) {
      if (!(await columnExists(conn, 'endpoints', name))) {
        await conn.query(`ALTER TABLE endpoints ADD COLUMN ${name} ${def}`);
        console.log('Added endpoints.' + name);
      }
    }
    console.log('Endpoint host inventory migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
