/**
 * Phase 5 — registration body may include tenant_slug for multi-tenant enrollment.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSchema } = require('../src/schemas/agentSchemas');

test('registerSchema accepts optional tenant_slug', () => {
  const parsed = registerSchema.safeParse({
    body: {
      hostname: 'win10-01',
      tenant_slug: 'acme-corp',
    },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.body.tenant_slug, 'acme-corp');
});

test('registerSchema rejects oversized tenant_slug', () => {
  const parsed = registerSchema.safeParse({
    body: {
      hostname: 'h',
      tenant_slug: 'x'.repeat(65),
    },
  });
  assert.equal(parsed.success, false);
});
