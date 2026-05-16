#!/usr/bin/env node
/**
 * Ensures Express routes are documented in openapi.json (agent + admin + auth + ingest).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'openapi', 'openapi.json'), 'utf8'));
const documented = new Set(Object.keys(spec.paths || {}));

const routeFiles = [
  'src/routes/agentRoutes.js',
  'src/routes/adminRoutes.js',
  'src/routes/authRoutes.js',
  'src/routes/ingestRoutes.js',
];

const methodMap = { get: 'get', post: 'post', put: 'put', patch: 'patch', delete: 'delete' };
const found = new Set();

for (const rel of routeFiles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi;
  let m;
  while ((m = re.exec(text))) {
    const routePath = m[2];
    if (routePath.startsWith('/')) {
      found.add(`/api${routePath}`);
      found.add(`/api/v1${routePath}`);
    }
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
