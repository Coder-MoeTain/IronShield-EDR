#!/usr/bin/env node
/**
 * Import software vulnerabilities from JSON or CSV file.
 * Usage: npm run software:vuln-import -- --file=data/software-vulnerabilities-demo.json
 */
const fs = require('fs');
const path = require('path');
const SoftwareVulnerabilityService = require('../src/modules/software/softwareVulnerabilityService');

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    const values = cols.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return {
      name: row.name || row.normalized_name,
      normalized_name: row.normalized_name,
      vendor: row.vendor,
      cve_id: row.cve_id,
      cve_title: row.cve_title,
      severity: row.severity,
      affected_version_expression: row.affected_version_expression,
      fixed_version: row.fixed_version,
      cvss_score: row.cvss_score ? Number(row.cvss_score) : null,
      exploit_known: row.exploit_known === '1' || row.exploit_known === 'true',
      source: row.source || 'import-csv',
    };
  });
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  const file = fileArg
    ? fileArg.split('=')[1]
    : process.argv[process.argv.indexOf('--file') + 1];
  if (!file) {
    console.error('Usage: npm run software:vuln-import -- --file=path/to.json|csv');
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(abs, 'utf8');
  const records = abs.endsWith('.csv') ? parseCsv(raw) : JSON.parse(raw);
  if (!Array.isArray(records)) {
    console.error('Input must be an array (JSON) or CSV with header row');
    process.exit(1);
  }
  const result = await SoftwareVulnerabilityService.importBatch(records, 'import-cli');
  console.log(
    `Imported ${result.imported} records (${result.skipped} skipped, ${result.needs_review} needs review) from ${abs}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
