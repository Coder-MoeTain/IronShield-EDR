/**
 * MITRE ATT&CK coverage — techniques, rules, quality, alerts.
 */
const db = require('../../utils/db');
const { MITRE_TACTICS } = require('./constants');
const { loadRulesFromDisk } = require('./ruleLoader');

const COVERAGE_LEVELS = ['none', 'experimental', 'stable', 'tested', 'active'];

function techniqueId(t) {
  return typeof t === 'object' ? t.id : String(t);
}

async function getCoverage(tenantId = null) {
  let sql = `SELECT id, name, title, mitre_tactic, mitre_technique, enabled, status
             FROM detection_rules WHERE enabled = 1`;
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  const dbRules = await db.query(sql, params).catch(() => []);
  const codeRules = loadRulesFromDisk();

  const techniques = new Map();

  function ingestRule(rule, source) {
    const techs = [];
    if (rule.mitre?.techniques?.length) {
      rule.mitre.techniques.forEach((t) => techs.push(techniqueId(t)));
    } else if (rule.mitre_technique) techs.push(String(rule.mitre_technique));

    const tactics = rule.mitre?.tactics || (rule.mitre_tactic ? [rule.mitre_tactic] : []);

    for (const tech of techs) {
      if (!techniques.has(tech)) {
        techniques.set(tech, {
          technique: tech,
          tactics: new Set(),
          rules: [],
          stable_rules: 0,
          experimental_rules: 0,
          with_tests: 0,
          alert_count: 0,
          coverage_level: 'none',
        });
      }
      const entry = techniques.get(tech);
      tactics.forEach((t) => entry.tactics.add(t));
      entry.rules.push({
        id: rule.id,
        name: rule.name || rule.title,
        status: rule.status || 'stable',
        source,
        severity: rule.severity,
        platform: rule.platform,
        data_sources: rule.data_sources || [],
      });
      if (rule.status === 'stable') entry.stable_rules += 1;
      if (rule.status === 'experimental') entry.experimental_rules += 1;
      if (rule.tests?.length) entry.with_tests += 1;
    }
  }

  for (const r of dbRules) ingestRule(r, 'database');
  for (const r of codeRules) ingestRule(r, 'code');

  let alertSql = `
    SELECT mitre_technique, COUNT(*) AS c FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE mitre_technique IS NOT NULL`;
  const alertParams = [];
  if (tenantId != null) {
    alertSql += ' AND e.tenant_id = ?';
    alertParams.push(tenantId);
  }
  alertSql += ' GROUP BY mitre_technique';
  const alertCounts = await db.query(alertSql, alertParams).catch(() => []);
  for (const row of alertCounts) {
    const entry = techniques.get(String(row.mitre_technique));
    if (entry) entry.alert_count = Number(row.c) || 0;
  }

  for (const entry of techniques.values()) {
    if (entry.alert_count > 0) entry.coverage_level = 'active';
    else if (entry.with_tests > 0 && entry.stable_rules > 0) entry.coverage_level = 'tested';
    else if (entry.stable_rules > 0) entry.coverage_level = 'stable';
    else if (entry.experimental_rules > 0) entry.coverage_level = 'experimental';
  }

  const matrix = MITRE_TACTICS.map((tactic) => ({
    tactic,
    techniques: [...techniques.entries()]
      .filter(([, d]) => d.tactics.has(tactic))
      .map(([tech, d]) => ({
        technique: tech,
        rules: d.rules,
        alert_count: d.alert_count,
        coverage_level: d.coverage_level,
      })),
  }));

  const covered = [...techniques.keys()];
  const gaps = [];

  return {
    tactics: MITRE_TACTICS,
    matrix,
    techniques_covered: covered.length,
    techniques: Object.fromEntries(techniques),
    gaps,
    coverage_levels: COVERAGE_LEVELS,
  };
}

module.exports = { getCoverage, COVERAGE_LEVELS };
