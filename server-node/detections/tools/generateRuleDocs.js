#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadRulesFromDisk } = require('../../src/modules/detections/ruleLoader');
const mitreCoverageService = require('../../src/modules/detections/mitreCoverageService');

async function main() {
  const rules = loadRulesFromDisk();
  const mitre = await mitreCoverageService.getCoverage().catch(() => ({ techniques_covered: 0, matrix: [] }));

  const mitreMd = [
    '# MITRE ATT&CK Coverage',
    '',
    `Techniques covered: **${mitre.techniques_covered || 0}**`,
    '',
  ];
  for (const row of mitre.matrix || []) {
    mitreMd.push(`## ${row.tactic}`);
    for (const t of row.techniques || []) {
      mitreMd.push(`- **${t.technique}** (${t.coverage_level}) — ${t.rules?.length || 0} rules, ${t.alert_count || 0} alerts`);
    }
    mitreMd.push('');
  }
  fs.writeFileSync(path.resolve(__dirname, '../MITRE_COVERAGE.md'), mitreMd.join('\n'));

  const dsMd = [
    '# Data Source Coverage',
    '',
    '| Data Source | Rules |',
    '|-------------|-------|',
  ];
  const byDs = {};
  for (const r of rules) {
    for (const ds of r.data_sources || ['process_creation']) {
      byDs[ds] = (byDs[ds] || 0) + 1;
    }
  }
  for (const [ds, count] of Object.entries(byDs).sort()) {
    dsMd.push(`| ${ds} | ${count} |`);
  }
  fs.writeFileSync(path.resolve(__dirname, '../DATA_SOURCE_COVERAGE.md'), dsMd.join('\n'));
  console.log('Generated MITRE_COVERAGE.md and DATA_SOURCE_COVERAGE.md');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
