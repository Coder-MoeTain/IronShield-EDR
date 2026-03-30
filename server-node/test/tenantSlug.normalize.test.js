/**
 * Phase 5 — tenant slug normalization for DB lookup.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTenantSlug } = require('../src/services/TenantService');

test('normalizeTenantSlug lowercases and strips invalid chars', () => {
  assert.equal(normalizeTenantSlug('  Acme_Corp  '), 'acme-corp');
});

test('normalizeTenantSlug returns empty for blank', () => {
  assert.equal(normalizeTenantSlug(''), '');
  assert.equal(normalizeTenantSlug(null), '');
});
