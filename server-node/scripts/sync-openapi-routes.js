#!/usr/bin/env node
/**
 * Add minimal OpenAPI path entries for Express routes missing from openapi.json.
 * Uses mount prefixes so /software/inventory maps correctly.
 */
const fs = require('fs');
const path = require('path');
const { ROUTE_MOUNT_MAP, collectRoutesFromFile } = require('./lib/openapiRouteMounts');

const root = path.join(__dirname, '..');
const specPath = path.join(root, 'openapi', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
spec.paths = spec.paths || {};

const methodMap = { get: 'get', post: 'post', put: 'put', patch: 'patch', delete: 'delete' };
let added = 0;

function tagForPath(apiPath) {
  if (apiPath.includes('/agent/')) return 'Agent';
  if (apiPath.includes('/admin/')) return 'Admin';
  if (apiPath.includes('/software/')) return 'Software';
  if (apiPath.includes('/detections/')) return 'Detections';
  if (apiPath.includes('/console/')) return 'Console';
  if (apiPath.includes('/auth/')) return 'Auth';
  if (apiPath.includes('/ingest/')) return 'Ingest';
  return 'API';
}

function ensurePath(apiPath, method) {
  if (!spec.paths[apiPath]) {
    spec.paths[apiPath] = {};
    added += 1;
  }
  const m = methodMap[method];
  if (!spec.paths[apiPath][m]) {
    spec.paths[apiPath][m] = {
      summary: `${method.toUpperCase()} ${apiPath}`,
      tags: [tagForPath(apiPath)],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'object' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
        },
        '401': { description: 'Unauthorized' },
      },
    };
  }
}

for (const rel of Object.keys(ROUTE_MOUNT_MAP)) {
  const routes = collectRoutesFromFile(root, rel);
  for (const { method, path: apiPath } of routes) {
    ensurePath(apiPath, method);
  }
}

ensurePath('/healthz', 'get');
ensurePath('/readyz', 'get');
ensurePath('/api/openapi.json', 'get');
ensurePath('/api/v1/openapi.json', 'get');

fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
console.log(`OpenAPI routes synced: ${added} new path(s), ${Object.keys(spec.paths).length} total`);
