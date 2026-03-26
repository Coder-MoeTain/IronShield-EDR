/**
 * GC: purge old per-event idempotency rows.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  const days = parseInt(process.env.AGENT_EVENT_IDEMPOTENCY_RETENTION_DAYS || '7', 10);
  const r = await db.execute(
    `DELETE FROM agent_event_ids
     WHERE first_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [Math.max(1, days)]
  );
  // eslint-disable-next-line no-console
  console.log(`OK: agent_event_ids gc deleted=${r.affectedRows} retentionDays=${Math.max(1, days)}`);
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

