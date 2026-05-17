#!/usr/bin/env node
/**
 * Import software vulnerabilities from JSON file.
 * Usage: npm run software:vuln-import -- --file=data/software-vulnerabilities.json
 */
const fs = require('fs');
const path = require('path');
const SoftwareVulnerabilityService = require('../src/modules/software/softwareVulnerabilityService');

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  const file = fileArg
    ? fileArg.split('=')[1]
    : process.argv[process.argv.indexOf('--file') + 1];
  if (!file) {
    console.error('Usage: node scripts/software-vuln-import.js --file=path/to.json');
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(abs, 'utf8');
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) {
    console.error('JSON must be an array');
    process.exit(1);
  }
  const result = await SoftwareVulnerabilityService.importBatch(records, 'import-cli');
  console.log(`Imported ${result.imported} vulnerability records from ${abs}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
