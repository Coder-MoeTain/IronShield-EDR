#!/usr/bin/env node
/**
 * Run common idempotent migrations for an older DB (fixes dns_query, sensor_queue_depth, av NGAV columns, etc.).
 * Run: cd server-node && npm run migrate-catch-up
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const steps = [
  'migrate-sensor-telemetry',
  'migrate-phase6-agent-update-telemetry',
  'migrate-phase8-edr-policy-sync',
  'migrate-phase7-ngav-telemetry',
  'migrate-normalized-events-parity',
];

for (const s of steps) {
  console.log('\n>>> npm run', s, '\n');
  execSync(`npm run ${s}`, { stdio: 'inherit', cwd: root, shell: true });
}
console.log('\n>>> migrate-catch-up finished\n');
