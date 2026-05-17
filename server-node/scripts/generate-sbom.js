#!/usr/bin/env node
/**
 * Generate a minimal CycloneDX-style SBOM from package-lock.json (Node backend).
 */
const fs = require('fs');
const path = require('path');

const lockPath = path.join(__dirname, '../package-lock.json');
const outPath = path.join(__dirname, '../artifacts/sbom-backend.json');

function main() {
  if (!fs.existsSync(lockPath)) {
    console.error('package-lock.json not found');
    process.exit(1);
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const packages = lock.packages || {};
  const components = [];

  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!pkgPath || !meta.version) continue;
    const name = meta.name || pkgPath.replace(/^node_modules\//, '');
    components.push({
      type: 'library',
      name,
      version: meta.version,
      purl: `pkg:npm/${name}@${meta.version}`,
    });
  }

  const bom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: { name: 'ironshield-edr-backend', type: 'application', version: '1.0.0' },
    },
    components,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(bom, null, 2));
  console.log(`SBOM written: ${outPath} (${components.length} components)`);
}

main();
