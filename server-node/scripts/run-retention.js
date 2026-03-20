#!/usr/bin/env node
/**
 * Run retention policies - purge old data
 * Run: node scripts/run-retention.js
 * Or via cron: 0 2 * * * node /path/to/scripts/run-retention.js
 */
require('dotenv').config();
const RetentionService = require('../src/services/RetentionService');

async function main() {
  const { totalDeleted } = await RetentionService.runAllPolicies();
  console.log(`Retention complete. Deleted ${totalDeleted} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
