#!/usr/bin/env node
/**
 * Validates server-node/openapi/openapi.json structure (no external OpenAPI parser dependency).
 * Run: node scripts/validate-openapi.js
 */
const fs = require('fs');
const path = require('path');

const specPath = path.resolve(__dirname, '..', 'openapi', 'openapi.json');
const raw = fs.readFileSync(specPath, 'utf8');
const spec = JSON.parse(raw);

if (spec.openapi !== '3.0.3' && !String(spec.openapi || '').startsWith('3.0.')) {
  console.error('Expected openapi 3.0.x, got:', spec.openapi);
  process.exit(1);
}
if (!spec.info?.title || !spec.info?.version) {
  console.error('Missing info.title or info.version');
  process.exit(1);
}
if (!spec.paths || typeof spec.paths !== 'object') {
  console.error('Missing paths');
  process.exit(1);
}
const requiredPaths = ['/healthz', '/api/openapi.json', '/api/agent/ping', '/api/agent/heartbeat', '/api/admin/endpoints'];
for (const p of requiredPaths) {
  if (!spec.paths[p]) {
    console.error('Contract must document path:', p);
    process.exit(1);
  }
}
console.log('OpenAPI spec OK:', spec.info.title, spec.info.version, `(${Object.keys(spec.paths).length} paths)`);
