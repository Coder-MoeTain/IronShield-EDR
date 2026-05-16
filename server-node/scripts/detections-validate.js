#!/usr/bin/env node
require('dotenv').config();
const { loadRulesFromDisk } = require('../src/services/DetectionCodeEngine');

const required = ['id', 'name', 'severity', 'platform'];

function main() {
  const rules = loadRulesFromDisk();
  let errors = 0;
  for (const r of rules) {
    for (const k of required) {
      if (!r[k]) {
        console.error(`[${r._file}] missing ${k}`);
        errors += 1;
      }
    }
    if (!/^IRN-WIN-\d+/.test(r.id || '')) {
      console.warn(`[${r.id}] id should follow IRN-WIN-####`);
    }
  }
  console.log(`Validated ${rules.length} rules, ${errors} error(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
