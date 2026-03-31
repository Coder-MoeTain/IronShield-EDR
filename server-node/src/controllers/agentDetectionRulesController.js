/**
 * Agent-facing detection rules — enabled IOA definitions for local evaluation on the sensor.
 */
const db = require('../utils/db');

function normalizeConditions(row) {
  let c = row.conditions;
  if (typeof c === 'string') {
    try {
      c = JSON.parse(c || '{}');
    } catch {
      c = {};
    }
  }
  return c;
}

async function getDetectionRules(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT id, name, title, severity, conditions, mitre_tactic, mitre_technique, updated_at
       FROM detection_rules WHERE enabled = 1 ORDER BY id ASC`
    );
    const rules = rows.map((r) => ({
      id: typeof r.id === 'bigint' ? Number(r.id) : Number(r.id),
      name: r.name,
      title: r.title,
      severity: r.severity,
      conditions: normalizeConditions(r),
      mitre_tactic: r.mitre_tactic,
      mitre_technique: r.mitre_technique,
    }));
    const times = rows.map((r) => r.updated_at).filter(Boolean);
    const maxTs = times.length ? Math.max(...times.map((t) => new Date(t).getTime())) : 0;
    const version = `${rules.length}-${maxTs}`;
    res.json({ version, rules });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDetectionRules };
