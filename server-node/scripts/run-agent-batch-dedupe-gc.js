/**
 * GC: purge old agent_event_batches rows (idempotency table) to prevent unbounded growth.
 *
 * Env:
 * - AGENT_BATCH_DEDUPE_RETENTION_DAYS (default: 14)
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  const days = Math.max(1, parseInt(process.env.AGENT_BATCH_DEDUPE_RETENTION_DAYS || '14', 10) || 14);
  const r = await db.execute(
    `DELETE FROM agent_event_batches
     WHERE received_at < (NOW() - INTERVAL ? DAY)`,
    [days]
  );
  // eslint-disable-next-line no-console
  console.log(`OK: agent_event_batches gc deleted=${r.affectedRows} retentionDays=${days}`);
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

