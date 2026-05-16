#!/usr/bin/env node
/**
 * Add minimal OpenAPI path entries for Express routes missing from openapi.json.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const specPath = path.join(root, 'openapi', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
spec.paths = spec.paths || {};

const routeFiles = [
  'src/routes/agentRoutes.js',
  'src/routes/adminRoutes.js',
  'src/routes/authRoutes.js',
  'src/routes/ingestRoutes.js',
  'src/routes/consoleRoutes.js',
];

const methodMap = { get: 'get', post: 'post', put: 'put', patch: 'patch', delete: 'delete' };
let added = 0;

function ensurePath(apiPath, method) {
  if (!spec.paths[apiPath]) {
    spec.paths[apiPath] = {};
    added += 1;
  }
  const m = methodMap[method];
  if (!spec.paths[apiPath][m]) {
    spec.paths[apiPath][m] = {
      summary: `${method.toUpperCase()} ${apiPath}`,
      tags: apiPath.includes('/agent') ? ['Agent'] : apiPath.includes('/admin') ? ['Admin'] : ['API'],
      responses: {
        '200': { description: 'OK' },
        '401': { description: 'Unauthorized' },
      },
    };
  }
}

for (const rel of routeFiles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = re.exec(text))) {
    const method = match[1].toLowerCase();
    const routePath = match[2];
    if (!routePath.startsWith('/')) continue;
    const full = `/api${routePath}`;
    ensurePath(full, method);
    ensurePath(full.replace(/^\/api\//, '/api/v1/'), method);
  }
}

ensurePath('/healthz', 'get');
ensurePath('/readyz', 'get');
ensurePath('/api/openapi.json', 'get');
ensurePath('/api/v1/openapi.json', 'get');

fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
console.log(`OpenAPI routes synced: ${added} new path(s), ${Object.keys(spec.paths).length} total`);
