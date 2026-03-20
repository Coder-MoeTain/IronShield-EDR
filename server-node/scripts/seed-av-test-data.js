#!/usr/bin/env node
/**
 * Seed sample AV detections and quarantine for testing the UI.
 * Run: node scripts/seed-av-test-data.js
 * Requires: migrate-phase7.js, at least one endpoint
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function seed() {
  const [ep] = await db.query('SELECT id, hostname FROM endpoints ORDER BY id LIMIT 1');
  if (!ep) {
    console.log('[AV Test] No endpoints. Register an agent first, then run this script.');
    process.exit(1);
  }

  await db.execute(
    `INSERT INTO av_scan_results (endpoint_id, file_path, file_name, sha256, detection_name, detection_type, family, severity, score, disposition)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ep.id,
      'C:\\Users\\Test\\Downloads\\eicar.com',
      'eicar.com',
      '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
      'EICAR-Test-File',
      'hash',
      'Test',
      'low',
      100,
      'quarantined',
    ]
  );

  await db.execute(
    `INSERT INTO av_quarantine_items (endpoint_id, original_path, quarantine_path, sha256, detection_name, quarantined_by, status)
     VALUES (?, ?, ?, ?, ?, ?, 'quarantined')`,
    [
      ep.id,
      'C:\\Users\\Test\\Downloads\\eicar.com',
      'C:\\ProgramData\\EDR\\quarantine\\test123',
      '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
      'EICAR-Test-File',
      'seed-script',
    ]
  );

  console.log('[AV Test] Added sample detection and quarantine for', ep.hostname);
  process.exit(0);
}

seed().catch((err) => {
  console.error('[AV Test] Error:', err.message);
  if (err.message?.includes('av_scan_results') || err.message?.includes('av_quarantine')) {
    console.log('Run: node scripts/migrate-phase7.js');
  }
  process.exit(1);
});
