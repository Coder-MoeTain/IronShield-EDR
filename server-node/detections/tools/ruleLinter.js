#!/usr/bin/env node
require('dotenv').config();
const { lintRules } = require('../../src/modules/detections/ruleLinter');

function main() {
  const result = lintRules();
  console.log(`Lint findings: ${result.findings.length} (${result.error_count} errors, ${result.warning_count} warnings)`);
  for (const f of result.findings.slice(0, 50)) {
    const prefix = f.severity === 'error' ? 'ERROR' : 'WARN';
    console.log(`  [${prefix}] ${f.rule_id} ${f.code}: ${f.message}`);
  }
  if (process.env.DETECTIONS_LINT_STRICT === 'true' && !result.ok) process.exit(1);
  process.exit(0);
}

main();
