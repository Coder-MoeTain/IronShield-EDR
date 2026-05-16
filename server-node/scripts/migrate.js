#!/usr/bin/env node
/**
 * Database migrations (Phase 2).
 *
 *   npm run migrate          — apply pending migrations
 *   npm run migrate:status   — list pending/applied
 *   npm run migrate:rollback — revert last batch (module migrations with down() only)
 */
require('dotenv').config();
const { migrate, status, rollback, validate } = require('./lib/migrateRunner');

const cmd = process.argv[2] || 'up';
const arg = process.argv[3];

async function main() {
  if (cmd === 'up' || cmd === 'migrate') {
    await migrate();
    return;
  }
  if (cmd === 'status') {
    await status();
    return;
  }
  if (cmd === 'rollback') {
    const steps = parseInt(arg || '1', 10);
    await rollback(Number.isFinite(steps) && steps > 0 ? steps : 1);
    return;
  }
  if (cmd === 'validate') {
    await validate();
    return;
  }
  console.error(`Unknown command: ${cmd}\nUsage: migrate.js [up|status|rollback|validate] [steps]\n`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
