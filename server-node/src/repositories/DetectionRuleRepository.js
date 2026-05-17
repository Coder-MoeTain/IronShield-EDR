const db = require('../utils/db');
const { loadRulesFromDisk } = require('../modules/detections/ruleLoader');

async function listCodeRules(filters = {}) {
  let rules = loadRulesFromDisk({ packId: filters.pack_id });
  if (filters.status) rules = rules.filter((r) => r.status === filters.status);
  if (filters.platform) rules = rules.filter((r) => r.platform === filters.platform);
  if (filters.tenant_id) {
    const overrides = await db.query(
      'SELECT * FROM detection_rule_tenant_overrides WHERE tenant_id = ?',
      [filters.tenant_id]
    ).catch(() => []);
    const omap = new Map(overrides.map((o) => [o.rule_id, o]));
    rules = rules.map((r) => {
      const o = omap.get(r.id);
      if (!o) return r;
      return {
        ...r,
        enabled: o.enabled != null ? o.enabled === 1 : r.enabled,
        severity: o.severity_override || r.severity,
        risk_score: o.risk_score_override ?? r.risk_score,
      };
    });
  }
  return rules;
}

async function getById(ruleId) {
  return listCodeRules().then((rules) => rules.find((r) => r.id === ruleId) || null);
}

module.exports = { listCodeRules, getById };
