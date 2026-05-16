/**
 * Phase 2 migration runner — tracks applied migrations in schema_migrations.
 */
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const { manifest } = require('../migrations/manifest');
const { getDbConfig, withConnection, tableExists } = require('./migrationHelpers');

async function getConnection() {
  return mysql.createConnection(getDbConfig());
}

async function ensureTrackingTable(conn) {
  const database = getDbConfig().database;
  if (await tableExists(conn, database, 'schema_migrations')) return;
  const bootstrap = require('../migrations/000_schema_migrations');
  await bootstrap.up();
}

async function getAppliedIds(conn) {
  const [rows] = await conn.query('SELECT id FROM schema_migrations ORDER BY batch ASC, applied_at ASC');
  return new Set(rows.map((r) => r.id));
}

async function getLastBatch(conn) {
  const [rows] = await conn.query('SELECT MAX(batch) AS b FROM schema_migrations');
  return rows[0]?.b ?? 0;
}

function runLegacyScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Legacy migration failed (${scriptPath}) exit ${code}`));
    });
  });
}

async function runEntry(entry) {
  if (entry.legacyScript) {
    return runLegacyScript(entry.legacyScript);
  }
  const mod = require(entry.module);
  if (typeof mod.up !== 'function') {
    throw new Error(`Migration ${entry.id} has no up()`);
  }
  await mod.up();
}

async function rollbackEntry(entry) {
  if (entry.legacyScript) {
    console.warn(`  skip legacy (no down): ${entry.id}`);
    return;
  }
  const mod = require(entry.module);
  if (typeof mod.down !== 'function') {
    console.warn(`  skip (no down): ${entry.id}`);
    return;
  }
  await mod.down();
}

function checksumForEntry(entry) {
  const target = entry.module || entry.legacyScript;
  if (!target || !fs.existsSync(target)) return null;
  const raw = fs.readFileSync(target);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function recordApplied(conn, entry, batch) {
  const checksum = checksumForEntry(entry);
  try {
    await conn.query(
      'INSERT INTO schema_migrations (id, batch, description, checksum, status) VALUES (?, ?, ?, ?, ?)',
      [entry.id, batch, entry.description || entry.id, checksum, 'applied']
    );
  } catch {
    await conn.query('INSERT INTO schema_migrations (id, batch, description) VALUES (?, ?, ?)', [
      entry.id,
      batch,
      entry.description || entry.id,
    ]);
  }
}

async function validate() {
  const conn = await getConnection();
  try {
    await ensureTrackingTable(conn);
    const [rows] = await conn.query(
      'SELECT id, checksum FROM schema_migrations WHERE checksum IS NOT NULL'
    );
    let mismatches = 0;
    for (const row of rows) {
      const entry = manifest.find((e) => e.id === row.id);
      if (!entry) continue;
      const current = checksumForEntry(entry);
      if (current && row.checksum && current !== row.checksum) {
        console.error(`Checksum mismatch: ${row.id}`);
        mismatches += 1;
      }
    }
    const applied = await getAppliedIds(conn);
    const pending = manifest.filter((e) => !applied.has(e.id));
    if (pending.length > 0) {
      console.error(`Pending migrations: ${pending.map((p) => p.id).join(', ')}`);
      process.exit(1);
    }
    if (mismatches > 0) {
      console.error(`${mismatches} migration checksum(s) changed after apply.`);
      process.exit(1);
    }
    console.log('Migration validate OK');
  } finally {
    await conn.end();
  }
}

async function migrate() {
  const conn = await getConnection();
  try {
    await ensureTrackingTable(conn);
    const applied = await getAppliedIds(conn);
    const batch = (await getLastBatch(conn)) + 1;
    let ran = 0;

    for (const entry of manifest) {
      if (applied.has(entry.id)) {
        continue;
      }
      console.log(`\n▶ ${entry.id}${entry.description ? ` — ${entry.description}` : ''}\n`);
      await runEntry(entry);
      await recordApplied(conn, entry, batch);
      applied.add(entry.id);
      ran += 1;
    }

    if (ran === 0) {
      console.log('\n✓ Database is up to date (no pending migrations).\n');
    } else {
      console.log(`\n✓ Applied ${ran} migration(s) in batch ${batch}.\n`);
    }
  } finally {
    await conn.end();
  }
}

async function status() {
  const conn = await getConnection();
  try {
    await ensureTrackingTable(conn);
    const applied = await getAppliedIds(conn);
    const pending = manifest.filter((e) => !applied.has(e.id));
    console.log('\nMigration status\n');
    console.log(`Applied: ${applied.size} / ${manifest.length}`);
    if (pending.length === 0) {
      console.log('Pending: none\n');
    } else {
      console.log('Pending:');
      for (const p of pending) {
        console.log(`  - ${p.id}`);
      }
      console.log('');
    }
    const [recent] = await conn.query(
      'SELECT id, batch, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 8'
    );
    if (recent.length > 0) {
      console.log('Recent:');
      for (const r of recent) {
        console.log(`  [batch ${r.batch}] ${r.id} @ ${r.applied_at}`);
      }
      console.log('');
    }
  } finally {
    await conn.end();
  }
}

async function rollback(steps = 1) {
  const conn = await getConnection();
  try {
    await ensureTrackingTable(conn);
    const lastBatch = await getLastBatch(conn);
    if (!lastBatch) {
      console.log('\nNothing to roll back.\n');
      return;
    }

    const batchesToRevert = [];
    for (let b = lastBatch; b > lastBatch - steps && b > 0; b -= 1) {
      batchesToRevert.push(b);
    }

    for (const batch of batchesToRevert) {
      const [rows] = await conn.query(
        'SELECT id FROM schema_migrations WHERE batch = ? ORDER BY applied_at DESC',
        [batch]
      );
      if (rows.length === 0) continue;

      console.log(`\nRolling back batch ${batch} (${rows.length} migration(s))…\n`);
      const ids = rows.map((r) => r.id);
      const entries = manifest.filter((e) => ids.includes(e.id)).reverse();

      for (const entry of entries) {
        console.log(`  ◀ ${entry.id}`);
        await rollbackEntry(entry);
        await conn.query('DELETE FROM schema_migrations WHERE id = ?', [entry.id]);
      }
    }
    console.log('\n✓ Rollback complete.\n');
  } finally {
    await conn.end();
  }
}

module.exports = { migrate, status, rollback, validate, manifest };
