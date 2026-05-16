/**
 * Tenant isolation — MySQL integration (optional).
 * Run: RUN_DB_TESTS=true npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const RUN = process.env.RUN_DB_TESTS === 'true' || process.env.CI_DB_TESTS === 'true';

test('tenant isolation integration', { skip: !RUN }, async (t) => {
  const db = require('../src/utils/db');
  const AlertService = require('../src/services/AlertService');
  const EndpointService = require('../src/services/EndpointService');

  const defaultRows = await db.query("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1");
  const demoRows = await db.query("SELECT id FROM tenants WHERE slug = 'demo-tenant-b' LIMIT 1");
  const tenantA = defaultRows[0]?.id;
  const tenantB = demoRows[0]?.id;

  if (!tenantA || !tenantB) {
    t.skip('Seed tenants missing — run npm run migrate && npm run seed');
    return;
  }

  const keyA = `test-${Date.now()}-a`;
  const keyB = `test-${Date.now()}-b`;

  const insA = await db.execute(
    `INSERT INTO endpoints (agent_key, tenant_id, hostname, status)
     VALUES (?, ?, 'iso-test-a', 'unknown')`,
    [keyA, tenantA]
  );
  const insB = await db.execute(
    `INSERT INTO endpoints (agent_key, tenant_id, hostname, status)
     VALUES (?, ?, 'iso-test-b', 'unknown')`,
    [keyB, tenantB]
  );
  const endpointA = insA.insertId;
  const endpointB = insB.insertId;

  try {
    const epFromB = await EndpointService.getById(endpointB, tenantA);
    assert.equal(epFromB, null, 'tenant A must not read tenant B endpoint');

    const epFromBScoped = await EndpointService.getById(endpointB, tenantB);
    assert.ok(epFromBScoped, 'tenant B can read own endpoint');

    const alertIns = await db.execute(
      `INSERT INTO alerts (endpoint_id, tenant_id, title, severity, confidence, first_seen, last_seen, status)
       VALUES (?, ?, 'iso-test-alert', 'low', 1.0, NOW(), NOW(), 'new')`,
      [endpointB, tenantB]
    );
    const alertId = alertIns.insertId;

    const patched = await AlertService.patch(alertId, { status: 'investigating' }, tenantA);
    assert.equal(patched, null, 'tenant A cannot patch tenant B alert');

    const patchedOk = await AlertService.patch(alertId, { status: 'investigating' }, tenantB);
    assert.ok(patchedOk, 'tenant B can patch own alert');

    await db.execute('DELETE FROM alerts WHERE id = ?', [alertId]);
  } finally {
    await db.execute('DELETE FROM endpoints WHERE id IN (?, ?)', [endpointA, endpointB]);
  }
});
