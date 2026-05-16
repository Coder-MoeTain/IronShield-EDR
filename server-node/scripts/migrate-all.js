#!/usr/bin/env node
/**
 * @deprecated Use `npm run migrate` (Phase 2 runner with schema_migrations tracking).
 */
console.warn('[migrate-all] deprecated — use: npm run migrate\n');
require('dotenv').config();
const { migrate } = require('./lib/migrateRunner');

migrate().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
