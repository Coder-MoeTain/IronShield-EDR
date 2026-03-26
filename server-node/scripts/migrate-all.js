#!/usr/bin/env node
/**
 * Enterprise baseline: run all idempotent migrations in a consistent order.
 * Usage: cd server-node && npm run migrate-all
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const steps = [
  // existing platform migrations
  'migrate-phase5-endpoints-tenant',
  'migrate-endpoint-metrics',
  'migrate-sensor-telemetry',
  'migrate-phase6-agent-update-telemetry',
  'migrate-agent-release-signatures',
  'migrate-phase7-ngav-telemetry',
  'migrate-phase8-edr-policy-sync',
  'migrate-normalized-events-parity',
  'migrate-falcon-ui-pack',
  'migrate-capabilities-v2',

  // XDR additions
  'migrate-xdr-events',
  'migrate-xdr-detections',
  'migrate-xdr-incident-links',
  'migrate-xdr-autoresponse',
  'migrate-xdr-ip-feeds',

  // console UX tables
  'migrate-user-saved-views',

  // compliance
  'migrate-audit-logs',
];

for (const s of steps) {
  console.log('\n>>> npm run', s, '\n');
  execSync(`npm run ${s}`, { stdio: 'inherit', cwd: root, shell: true });
}
console.log('\n>>> migrate-all finished\n');

