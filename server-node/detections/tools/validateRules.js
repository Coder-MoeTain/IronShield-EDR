#!/usr/bin/env node
require('dotenv').config();
const { validateRules } = require('../../src/modules/detections/ruleValidator');

function main() {
  const result = validateRules();
  const { stats } = result;

  console.log('Detection rule validation');
  console.log('========================');
  console.log(`Total rules:        ${stats.total}`);
  console.log(`Stable:             ${stats.stable}`);
  console.log(`Experimental:       ${stats.experimental}`);
  console.log(`Professional:       ${stats.professional}`);
  console.log(`With tests:         ${stats.with_tests}`);
  console.log(`Without tests:      ${stats.without_tests}`);
  console.log(`MITRE mapped:       ${stats.mitre_mapped}`);
  console.log(`Invalid:            ${stats.invalid}`);

  if (result.warnings.length) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    result.warnings.slice(0, 20).forEach((w) => console.warn(`  - ${w}`));
    if (result.warnings.length > 20) console.warn(`  ... and ${result.warnings.length - 20} more`);
  }

  if (result.errors.length) {
    console.error(`\nErrors (${result.errors.length}):`);
    result.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('\nPASS');
  process.exit(0);
}

main();
