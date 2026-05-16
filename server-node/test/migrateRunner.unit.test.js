const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { manifest } = require('../scripts/migrations/manifest');

test('migration manifest has unique ids', () => {
  const ids = manifest.map((m) => m.id);
  assert.equal(ids.length, new Set(ids).size);
});

test('migration manifest starts with schema_migrations bootstrap', () => {
  assert.equal(manifest[0].id, '000_schema_migrations');
});

test('phase2 tenant isolation module exists', () => {
  const entry = manifest.find((m) => m.id === '20260516120000_phase2_tenant_isolation');
  assert.ok(entry?.module);
  assert.ok(require('fs').existsSync(entry.module));
});

test('phase2 permissions module exports up/down', () => {
  const mod = require('../scripts/migrations/20260516120100_phase2_enterprise_permissions');
  assert.equal(typeof mod.up, 'function');
  assert.equal(typeof mod.down, 'function');
});
