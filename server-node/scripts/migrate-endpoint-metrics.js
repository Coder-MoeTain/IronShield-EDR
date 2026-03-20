#!/usr/bin/env node
/**
 * Migration - endpoint_metrics table and endpoint resource columns
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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS endpoint_metrics (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        endpoint_id INT UNSIGNED NOT NULL,
        cpu_percent DECIMAL(5,2),
        ram_percent DECIMAL(5,2),
        ram_total_mb INT UNSIGNED,
        ram_used_mb INT UNSIGNED,
        disk_percent DECIMAL(5,2),
        disk_total_gb DECIMAL(10,2),
        disk_used_gb DECIMAL(10,2),
        network_rx_mbps DECIMAL(10,2),
        network_tx_mbps DECIMAL(10,2),
        collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE,
        INDEX idx_metrics_endpoint (endpoint_id),
        INDEX idx_metrics_collected (collected_at)
      ) ENGINE=InnoDB
    `);
    console.log('Created endpoint_metrics');

    for (const col of ['cpu_percent', 'ram_percent', 'disk_percent']) {
      if (!(await columnExists(conn, 'endpoints', col))) {
        await conn.query(`ALTER TABLE endpoints ADD COLUMN ${col} DECIMAL(5,2) NULL`);
        console.log('Added', col, 'to endpoints');
      }
    }
    console.log('Endpoint metrics migration complete');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
