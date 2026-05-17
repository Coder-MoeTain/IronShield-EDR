#!/usr/bin/env node
require('dotenv').config();
const { runAllTests } = require('../../src/modules/detections/ruleTester');

function main() {
  const result = runAllTests();
  console.log(`Detection tests: ${result.passed} passed, ${result.failed} failed (${result.total} total)`);
  for (const r of result.results) {
    if (r.ok) console.log(`  OK  ${r.id}`);
    else {
      console.error(`  FAIL ${r.id}`);
      (r.failures || []).forEach((f) => console.error(`       ${f}`));
    }
  }
  process.exit(result.ok ? 0 : 1);
}

main();
