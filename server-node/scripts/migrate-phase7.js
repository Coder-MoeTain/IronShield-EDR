#!/usr/bin/env node
/**
 * Phase 7 migration - Antivirus module tables
 * Run: node scripts/migrate-phase7.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'edr_platform',
};

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
    if (!(await tableExists(conn, 'endpoints'))) {
      console.log('Run schema and phase migrations first. Skipping Phase 7.');
      process.exit(1);
    }

    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema-antivirus.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--') && s.toUpperCase() !== 'USE EDR_PLATFORM');

    for (const stmt of statements) {
      if (stmt.length > 5) {
        await conn.query(stmt);
        const tableMatch = stmt.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
        if (tableMatch) console.log('Created/verified', tableMatch[1]);
      }
    }

    console.log('Phase 7 (Antivirus) migration complete');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
