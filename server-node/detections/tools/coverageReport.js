#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mitreCoverageService = require('../../src/modules/detections/mitreCoverageService');
const dataSourceCoverageService = require('../../src/modules/detections/dataSourceCoverageService');
const { loadRulesFromDisk } = require('../../src/modules/detections/ruleLoader');

const OUT_DIR = path.resolve(__dirname, '../../reports/detection-coverage');

async function main() {
  const mitre = await mitreCoverageService.getCoverage();
  const dataSources = await dataSourceCoverageService.getCoverage();
  const rules = loadRulesFromDisk();

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const payload = {
    generated_at: new Date().toISOString(),
    rule_count: rules.length,
    mitre,
    data_sources: dataSources,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'coverage.json'), JSON.stringify(payload, null, 2));

  const html = `<!DOCTYPE html><html><head><title>IronShield Detection Coverage</title></head><body>
<h1>Detection Coverage Report</h1>
<p>Generated: ${payload.generated_at}</p>
<p>Rules: ${rules.length} | Techniques covered: ${mitre.techniques_covered}</p>
<h2>MITRE Matrix</h2>
<pre>${JSON.stringify(mitre.matrix, null, 2)}</pre>
<h2>Data Sources</h2>
<pre>${JSON.stringify(dataSources, null, 2)}</pre>
</body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'coverage.html'), html);

  console.log(`Coverage report: ${OUT_DIR}/coverage.json`);
  console.log(`HTML report: ${OUT_DIR}/coverage.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
