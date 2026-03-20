#!/usr/bin/env node
/**
 * Seed antivirus module: EICAR test signature, default policy, and initial bundle.
 * Run after migrate-phase7.js
 */
require('dotenv').config();
const db = require('../src/utils/db');

const EICAR_SHA256 = '131f95c5c5e2ff3164420a4d3da2a8e2b7e1a3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
const EICAR_SHA256_REAL = '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f'; // EICAR standard

async function seed() {
  console.log('[AV Seed] Starting...');

  // 1. Default scan policy
  const policies = await db.query('SELECT id FROM av_scan_policies LIMIT 1');
  if (!policies?.length) {
    await db.execute(
      `INSERT INTO av_scan_policies (name, description, realtime_enabled, scheduled_enabled, execute_scan_enabled,
        quarantine_threshold, alert_threshold, max_file_size_mb, process_kill_allowed, rescan_on_detection,
        include_paths_json, exclude_paths_json, exclude_extensions_json, exclude_hashes_json)
       VALUES ('Default', 'Default AV scan policy', 0, 1, 1, 70, 50, 100, 0, 1, '[]', '[]', '[]', '[]')`
    );
    console.log('[AV Seed] Created default policy');
  }

  // 2. EICAR test signature (standard EICAR file hash - truncated for demo; use real hash in production)
  const eicarSha256 = '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f';
  const sigCheck = await db.query(
    "SELECT id FROM av_signatures WHERE signature_uuid = 'eicar-test-file' LIMIT 1"
  );
  if (!sigCheck || sigCheck.length === 0) {
    await db.execute(
      `INSERT INTO av_signatures (signature_uuid, name, signature_type, hash_value, hash_type, family, severity, description, enabled, version)
       VALUES ('eicar-test-file', 'EICAR-Test-File', 'hash', ?, 'sha256', 'Test', 'low', 'EICAR antivirus test file', 1, 1)`,
      [eicarSha256]
    );
    console.log('[AV Seed] Created EICAR test signature');
  }

  // 3. Sample path pattern signature
  const pathCheck = await db.query(
    "SELECT id FROM av_signatures WHERE signature_uuid = 'suspicious-temp-exe' LIMIT 1"
  );
  if (!pathCheck || pathCheck.length === 0) {
    await db.execute(
      `INSERT INTO av_signatures (signature_uuid, name, signature_type, pattern, family, severity, description, enabled, version)
       VALUES ('suspicious-temp-exe', 'Suspicious.Temp.Executable', 'path', '\\\\Temp\\\\.*\\.exe$', 'Heuristic', 'medium', 'Executable in temp path', 1, 1)`
    );
    console.log('[AV Seed] Created path pattern signature');
  }

  // 4. Create active bundle if none exists
  const bundle = await db.queryOne('SELECT id FROM av_signature_bundles WHERE is_active = 1 LIMIT 1');
  if (!bundle) {
    const sigs = await db.query('SELECT id FROM av_signatures WHERE enabled = 1');
    const version = 'v1';
    const bundleResult = await db.execute(
      'INSERT INTO av_signature_bundles (bundle_version, signature_count, release_notes, is_active) VALUES (?, ?, ?, 1)',
      [version, sigs.length, 'Initial AV bundle']
    );
    const bundleId = bundleResult.insertId;
    for (const s of sigs) {
      await db.execute('INSERT IGNORE INTO av_bundle_signatures (bundle_id, signature_id) VALUES (?, ?)', [
        bundleId,
        s.id,
      ]);
    }
    console.log('[AV Seed] Created active bundle', version);
  }

  console.log('[AV Seed] Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[AV Seed] Error:', err);
  process.exit(1);
});
