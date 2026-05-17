#!/usr/bin/env node
require('dotenv').config();
const { replay, parseArgs } = require('../../src/modules/detections/ruleReplayService');

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const { report, reportPath } = await replay(opts);
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nReport written: ${reportPath}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

main();
