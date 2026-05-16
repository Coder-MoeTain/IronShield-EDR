#!/usr/bin/env node
/**
 * Duplicate /api/* paths as /api/v1/* in openapi.json for contract documentation.
 */
const fs = require('fs');
const path = require('path');

const specPath = path.resolve(__dirname, '..', 'openapi', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

spec.info.description =
  'Management (admin), sensor (agent), authentication, and ingest APIs. Legacy paths under `/api/*` remain supported; prefer `/api/v1/*` for new integrations.';

const v1Paths = {};
for (const [p, def] of Object.entries(spec.paths || {})) {
  if (p.startsWith('/api/') && !p.startsWith('/api/v1/')) {
    v1Paths[p.replace(/^\/api\//, '/api/v1/')] = def;
  }
}
spec.paths = { ...spec.paths, ...v1Paths };

fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
console.log(`OpenAPI synced: ${Object.keys(v1Paths).length} v1 paths added`);
