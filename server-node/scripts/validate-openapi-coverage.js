#!/usr/bin/env node
/**
 * Ensures Express routes are documented in openapi.json (with correct mount prefixes).
 */
const fs = require('fs');
const path = require('path');
const { ROUTE_MOUNT_MAP, collectRoutesFromFile } = require('./lib/openapiRouteMounts');

const root = path.join(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'openapi', 'openapi.json'), 'utf8'));
const documented = new Set(Object.keys(spec.paths || {}));

const found = new Set();

for (const rel of Object.keys(ROUTE_MOUNT_MAP)) {
  const routes = collectRoutesFromFile(root, rel);
  for (const { path: apiPath } of routes) {
    found.add(apiPath);
  }
}

found.add('/healthz');
found.add('/readyz');
found.add('/api/openapi.json');
found.add('/api/v1/openapi.json');

const allowUndocumented = new Set(
  (process.env.OPENAPI_COVERAGE_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const missing = [];
for (const p of found) {
  if (documented.has(p)) continue;
  if (allowUndocumented.has(p)) continue;
  missing.push(p);
}

if (missing.length > 0) {
  console.error('Undocumented routes (' + missing.length + '):');
  for (const p of missing.sort()) console.error('  ', p);
  process.exit(1);
}

console.log('OpenAPI route coverage OK:', found.size, 'route prefixes checked');
