/**
 * Migration: xdr_ip_blacklist_feeds
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS xdr_ip_blacklist_feeds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      name VARCHAR(128) NOT NULL,
      url VARCHAR(1024) NOT NULL,
      auth_header_name VARCHAR(128) NULL,
      auth_header_value VARCHAR(512) NULL,
      json_path VARCHAR(256) NULL,
      severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'high',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_sync_at DATETIME NULL,
      last_error VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant_active (tenant_id, is_active),
      INDEX idx_active (is_active)
    )
  `);
  // eslint-disable-next-line no-console
  console.log('OK: xdr_ip_blacklist_feeds');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

