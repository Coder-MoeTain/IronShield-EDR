/**
 * Migration: agent release rollouts (ring + tenant scoping + health gating metadata)
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function addColumnIfMissing(table, col, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, col]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function addIndexIfMissing(table, indexName, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function run() {
  await addColumnIfMissing('agent_releases', 'ring',
    `ALTER TABLE agent_releases ADD COLUMN ring VARCHAR(32) NOT NULL DEFAULT 'stable' AFTER version`
  );
  await addColumnIfMissing('agent_releases', 'tenant_id',
    `ALTER TABLE agent_releases ADD COLUMN tenant_id INT UNSIGNED NULL AFTER ring`
  );
  await addColumnIfMissing('agent_releases', 'health_gate',
    `ALTER TABLE agent_releases ADD COLUMN health_gate VARCHAR(32) NULL AFTER release_notes`
  );

  await addIndexIfMissing(
    'agent_releases',
    'idx_release_ring_current',
    `CREATE INDEX idx_release_ring_current ON agent_releases(ring, is_current, created_at)`
  );
  await addIndexIfMissing(
    'agent_releases',
    'idx_release_tenant_ring',
    `CREATE INDEX idx_release_tenant_ring ON agent_releases(tenant_id, ring, created_at)`
  );

  // Endpoints rollout state
  await addColumnIfMissing('endpoints', 'update_ring',
    `ALTER TABLE endpoints ADD COLUMN update_ring VARCHAR(32) NOT NULL DEFAULT 'stable' AFTER agent_version`
  );
  await addColumnIfMissing('endpoints', 'desired_agent_version',
    `ALTER TABLE endpoints ADD COLUMN desired_agent_version VARCHAR(32) NULL AFTER update_ring`
  );
  await addColumnIfMissing('endpoints', 'agent_update_state',
    `ALTER TABLE endpoints ADD COLUMN agent_update_state VARCHAR(32) NULL AFTER desired_agent_version`
  );
  await addColumnIfMissing('endpoints', 'last_agent_update_error',
    `ALTER TABLE endpoints ADD COLUMN last_agent_update_error VARCHAR(255) NULL AFTER agent_update_state`
  );
  await addColumnIfMissing('endpoints', 'last_agent_update_attempt_at',
    `ALTER TABLE endpoints ADD COLUMN last_agent_update_attempt_at DATETIME NULL AFTER last_agent_update_error`
  );

  // eslint-disable-next-line no-console
  console.log('OK: agent release rollouts + endpoint update state');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

