/**
 * Migration: agent event batch dedupe table (idempotency)
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_event_batches (
      endpoint_id INT UNSIGNED NOT NULL,
      batch_id VARCHAR(64) NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      event_count INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (endpoint_id, batch_id),
      INDEX idx_received (received_at)
    ) ENGINE=InnoDB;
  `);

  // eslint-disable-next-line no-console
  console.log('OK: agent_event_batches');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

