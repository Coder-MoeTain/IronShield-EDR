/**
 * Detection replay — evaluate historical events against current rule pack.
 */
const fs = require('fs');
const path = require('path');
const db = require('../../utils/db');
const EventNormalizationService = require('../../services/EventNormalizationService');
const { loadRulesFromDisk } = require('./ruleLoader');
const detectionEngine = require('./detectionEngine');
const { buildExplanation } = require('./alertExplainabilityService');

const REPORTS_DIR = path.resolve(__dirname, '../../../reports/detection-replay');

async function ensureTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_replay_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tenant_id BIGINT UNSIGNED NULL,
      pack_id VARCHAR(64) NULL,
      rule_id VARCHAR(64) NULL,
      date_from DATETIME NULL,
      date_to DATETIME NULL,
      dry_run TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'completed',
      report_json JSON NULL,
      performance_ms INT NULL,
      created_by VARCHAR(128) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

function parseArgs(argv) {
  const opts = { dry_run: false };
  for (const arg of argv) {
    if (arg.startsWith('--from=')) opts.date_from = arg.slice(7);
    if (arg.startsWith('--to=')) opts.date_to = arg.slice(5);
    if (arg.startsWith('--tenant=')) opts.tenant_id = arg.slice(9);
    if (arg.startsWith('--pack=')) opts.pack_id = arg.slice(7);
    if (arg.startsWith('--rule=')) opts.rule_id = arg.slice(7);
    if (arg === '--dry-run') opts.dry_run = true;
  }
  return opts;
}

async function replay(opts = {}) {
  const t0 = Date.now();
  await ensureTables();

  let sql = `
    SELECT ne.*, e.tenant_id, e.hostname
    FROM normalized_events ne
    JOIN endpoints e ON e.id = ne.endpoint_id
    WHERE 1=1`;
  const params = [];
  if (opts.tenant_id) {
    sql += ' AND e.tenant_id = ?';
    params.push(opts.tenant_id);
  }
  if (opts.date_from) {
    sql += ' AND ne.timestamp >= ?';
    params.push(opts.date_from);
  }
  if (opts.date_to) {
    sql += ' AND ne.timestamp <= ?';
    params.push(opts.date_to);
  }
  if (opts.event_type) {
    sql += ' AND ne.event_type = ?';
    params.push(opts.event_type);
  }
  sql += ' ORDER BY ne.timestamp ASC LIMIT 50000';

  const events = await db.query(sql, params).catch(() => []);
  let rules = loadRulesFromDisk({ packId: opts.pack_id });
  if (opts.rule_id) rules = rules.filter((r) => r.id === opts.rule_id);

  const alertsByRule = {};
  const alertsBySeverity = {};
  const ruleRuntime = {};
  let totalAlerts = 0;

  for (const row of events) {
    const norm = EventNormalizationService.normalize({
      endpoint_id: row.endpoint_id,
      event_type: row.event_type,
      timestamp: row.timestamp,
      raw_event_json:
        typeof row.raw_event_json === 'string' ? JSON.parse(row.raw_event_json) : row.raw_event_json,
    });
    const hits = detectionEngine.evaluate(norm, rules);
    for (const hit of hits) {
      totalAlerts += 1;
      alertsByRule[hit.rule_id] = (alertsByRule[hit.rule_id] || 0) + 1;
      alertsBySeverity[hit.severity] = (alertsBySeverity[hit.severity] || 0) + 1;
      buildExplanation(hit.rule, hit.matched_conditions);
    }
  }

  const runtimeStats = detectionEngine.getRuleRuntimeStats();
  const noisyRules = Object.entries(alertsByRule)
    .filter(([, c]) => c > 100)
    .map(([rule_id, count]) => ({ rule_id, count }))
    .sort((a, b) => b.count - a.count);

  const report = {
    total_events_replayed: events.length,
    total_alerts_generated: totalAlerts,
    alerts_by_rule: alertsByRule,
    alerts_by_severity: alertsBySeverity,
    new_alerts: [],
    suppressed_alerts: [],
    noisy_rules: noisyRules,
    performance_ms: Date.now() - t0,
    rule_runtime_stats: runtimeStats,
    dry_run: Boolean(opts.dry_run),
    filters: opts,
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const reportPath = path.join(REPORTS_DIR, `replay-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (!opts.dry_run) {
    await db.execute(
      `INSERT INTO detection_replay_runs (tenant_id, pack_id, rule_id, date_from, date_to, dry_run, report_json, performance_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.tenant_id || null,
        opts.pack_id || null,
        opts.rule_id || null,
        opts.date_from || null,
        opts.date_to || null,
        opts.dry_run ? 1 : 0,
        JSON.stringify(report),
        report.performance_ms,
      ]
    );
  }

  return { report, reportPath };
}

module.exports = { replay, parseArgs, ensureTables };
