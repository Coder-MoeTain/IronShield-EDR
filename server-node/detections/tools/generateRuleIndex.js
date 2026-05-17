#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadRulesFromDisk } = require('../../src/modules/detections/ruleLoader');

const OUT = path.resolve(__dirname, '../RULE_INDEX.md');

function main() {
  const rules = loadRulesFromDisk().sort((a, b) => a.id.localeCompare(b.id));
  const lines = [
    '# IronShield Detection Rule Index',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total rules: **${rules.length}**`,
    '',
    '| ID | Name | Severity | Status | Platform | MITRE |',
    '|----|------|----------|--------|----------|-------|',
  ];
  for (const r of rules) {
    const tech = (r.mitre?.techniques || [])
      .map((t) => (typeof t === 'object' ? t.id : t))
      .join(', ');
    lines.push(
      `| ${r.id} | ${r.name} | ${r.severity} | ${r.status} | ${r.platform} | ${tech || '—'} |`
    );
  }
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
}

main();
