#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { importSigmaYaml } = require('../../src/modules/detections/sigmaImportService');

function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='));
  if (!fileArg) {
    console.error('Usage: npm run detections:import-sigma -- --file=rule.yml');
    process.exit(1);
  }
  const filePath = path.resolve(fileArg.slice(7));
  const yamlText = fs.readFileSync(filePath, 'utf8');
  const draft = importSigmaYaml(yamlText);
  const outPath = path.join(
    path.dirname(filePath),
    `${draft.id}-sigma-draft.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2));
  console.log(`Draft rule written (disabled, experimental): ${outPath}`);
  console.log('Manual review and tests required before enabling.');
}

main();
