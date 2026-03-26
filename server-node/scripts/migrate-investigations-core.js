/**
 * Migration: investigation core tables.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS investigation_cases (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      case_id VARCHAR(32) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      endpoint_id INT UNSIGNED NULL,
      created_by VARCHAR(128) NULL,
      assigned_to VARCHAR(128) NULL,
      severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      status ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
      related_alert_ids JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_investigation_case_id (case_id),
      INDEX idx_inv_status (status),
      INDEX idx_inv_endpoint (endpoint_id),
      CONSTRAINT fk_inv_endpoint FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS investigation_case_notes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      case_id BIGINT UNSIGNED NOT NULL,
      author VARCHAR(128) NOT NULL,
      note TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_icn_case (case_id),
      CONSTRAINT fk_icn_case FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS investigation_artifacts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      case_id BIGINT UNSIGNED NOT NULL,
      artifact_type VARCHAR(64) NOT NULL,
      artifact_id VARCHAR(128) NULL,
      artifact_data JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ia_case (case_id),
      CONSTRAINT fk_ia_case FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // eslint-disable-next-line no-console
  console.log('OK: investigation_cases + notes + artifacts');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

