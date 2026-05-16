/**
 * MITRE ATT&CK coverage from DB rules + detection-as-code pack.
 */
const db = require('../utils/db');
const DetectionCodeEngine = require('./DetectionCodeEngine');

const TACTICS = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
];

async function getCoverage(tenantId = null) {
  let sql = `SELECT id, name, title, mitre_tactic, mitre_technique, enabled FROM detection_rules WHERE enabled = 1`;
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  const dbRules = await db.query(sql, params).catch(() => []);

  const codeRules = DetectionCodeEngine.loadRulesFromDisk();
  const techniques = new Map();

  function addRule(rule, source) {
    const tech = rule.mitre_technique || rule.mitre?.techniques?.[0];
    const tactic = rule.mitre_tactic || rule.mitre?.tactics?.[0];
    if (!tech) return;
    const key = String(tech);
    if (!techniques.has(key)) {
      techniques.set(key, {
        technique: key,
        tactics: new Set(),
        rules: [],
        alert_count: 0,
      });
    }
    const entry = techniques.get(key);
    if (tactic) entry.tactics.add(tactic);
    entry.rules.push({ id: rule.id || rule.name, name: rule.title || rule.name, source });
  }

  for (const r of dbRules) addRule(r, 'database');
  for (const r of codeRules) addRule(r, 'code');

  let alertSql = `
    SELECT mitre_technique, COUNT(*) AS c
    FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE mitre_technique IS NOT NULL
  `;
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

  const matrix = TACTICS.map((tactic) => {
    const covered = [];
    for (const [tech, data] of techniques.entries()) {
      if (data.tactics.has(tactic)) {
        covered.push({
          technique: tech,
          rule_count: data.rules.length,
          alert_count: data.alert_count,
        });
      }
    }
    return { tactic, techniques: covered, coverage_pct: covered.length > 0 ? 100 : 0 };
  });

  const totalTechniques = techniques.size;
  const coveredTactics = matrix.filter((m) => m.techniques.length > 0).length;

  return {
    tactics: matrix,
    summary: {
      total_techniques: totalTechniques,
      tactics_covered: coveredTactics,
      tactics_total: TACTICS.length,
      coverage_pct: Math.round((coveredTactics / TACTICS.length) * 100),
    },
  };
}

module.exports = { getCoverage, TACTICS };
