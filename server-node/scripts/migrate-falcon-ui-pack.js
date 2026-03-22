#!/usr/bin/env node
/**
 * Falcon UI pack — RTR session tables.
 * Run: cd server-node && npm run migrate-falcon-ui-pack
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'edr_platform',
  multipleStatements: true,
};

async function run() {
  const sqlPath = path.join(__dirname, '..', '..', 'database', 'migrate-falcon-ui-pack.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection(config);
  try {
    await conn.query(sql);
    console.log('migrate-falcon-ui-pack complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
