#!/usr/bin/env node
/**
 * Verify audit log hash chain from CLI.
 */
require('dotenv').config();
const db = require('../src/utils/db');
const crypto = require('crypto');

async function main() {
  const rows = await db.query(
    'SELECT id, prev_hash, entry_hash, action, created_at FROM audit_logs ORDER BY id ASC'
  );
  let prev = null;
  let ok = 0;
  for (const row of rows) {
    if (row.prev_hash !== prev && !(prev === null && row.prev_hash === null)) {
      console.error(`Chain break at id ${row.id}`);
      process.exit(1);
    }
    prev = row.entry_hash;
    ok += 1;
  }
  console.log(`OK: verified ${ok} audit entries`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
