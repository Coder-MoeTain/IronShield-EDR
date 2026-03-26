/**
 * Migration: triage core tables required by agent/task polling.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS triage_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      endpoint_id INT UNSIGNED NOT NULL,
      request_type VARCHAR(32) NOT NULL DEFAULT 'full',
      requested_by VARCHAR(128) NULL,
      alert_id BIGINT UNSIGNED NULL,
      case_id BIGINT UNSIGNED NULL,
      status ENUM('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      INDEX idx_tr_endpoint_status (endpoint_id, status),
      INDEX idx_tr_created (created_at),
      CONSTRAINT fk_tr_endpoint FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS triage_results (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      triage_request_id BIGINT UNSIGNED NOT NULL,
      result_json JSON NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_trr_req_time (triage_request_id, received_at),
      CONSTRAINT fk_trr_request FOREIGN KEY (triage_request_id) REFERENCES triage_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // eslint-disable-next-line no-console
  console.log('OK: triage_requests + triage_results');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

