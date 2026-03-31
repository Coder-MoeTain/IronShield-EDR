#!/usr/bin/env node
/**
 * Upsert 100 built-in IOA detection rules (idempotent on rule `name`).
 *
 * Usage (from server-node):
 *   node scripts/seed-detection-rules-100.js
 *
 * Requires DB config (same as server): .env with DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *
 * Uses ON DUPLICATE KEY UPDATE so re-running updates titles/conditions in place.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('../src/utils/db');
const { validateConditions } = require('../src/services/DetectionRuleService');
const { buildDetectionRulesPack100 } = require('./detection-rules-pack-100-data');

async function upsertRule(r) {
  validateConditions(r.conditions);
  const sql = `
    INSERT INTO detection_rules (name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      description = VALUES(description),
      enabled = VALUES(enabled),
      severity = VALUES(severity),
      conditions = VALUES(conditions),
      mitre_tactic = VALUES(mitre_tactic),
      mitre_technique = VALUES(mitre_technique)
  `;
  await db.execute(sql, [
    r.name,
    r.title,
    r.description,
    r.enabled,
    r.severity,
    JSON.stringify(r.conditions),
    r.mitre_tactic,
    r.mitre_technique,
  ]);
}

async function main() {
  const rules = buildDetectionRulesPack100();
  let n = 0;
  for (const r of rules) {
    await upsertRule(r);
    n += 1;
    if (n % 25 === 0) process.stdout.write(`  … ${n} rules written\n`);
  }
  console.log(`Done: upserted ${n} detection rules (pack ioa_*).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
