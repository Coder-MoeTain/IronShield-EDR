/**
 * Migration: per-event idempotency keys to prevent duplicate ingest on retries.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_event_ids (
      endpoint_id INT UNSIGNED NOT NULL,
      event_id VARCHAR(128) NOT NULL,
      first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (endpoint_id, event_id),
      INDEX idx_first_seen (first_seen_at)
    ) ENGINE=InnoDB;
  `);

  // eslint-disable-next-line no-console
  console.log('OK: agent_event_ids');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

