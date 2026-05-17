/**
 * Detection quality metrics and per-rule quality score.
 */
const db = require('../../utils/db');
const { loadRulesFromDisk } = require('./ruleLoader');
const { hasTestFixture } = require('./ruleValidator');
const path = require('path');

const DETECTIONS_ROOT = path.resolve(__dirname, '../../../detections');

function scoreRule(rule, metrics = {}) {
  let score = 0;
  const factors = [];
  const add = (pts, name) => {
    score += pts;
    factors.push({ name, points: pts });
  };

  if (hasTestFixture(rule, DETECTIONS_ROOT)) add(20, 'has_tests');
  if (rule.tests?.length >= 2) add(20, 'benign_and_malicious_fixtures');
  else if (hasTestFixture(rule, DETECTIONS_ROOT)) add(10, 'partial_fixtures');
  if (rule.mitre?.techniques?.length || rule.mitre_technique) add(10, 'mitre_mapped');
  if (rule.false_positives?.length) add(10, 'false_positive_notes');
  if (rule.response_guidance?.length) add(10, 'response_guidance');
  if ((metrics.false_positive_rate || 1) < 0.15) add(10, 'low_fp_rate');
  if ((metrics.noisy_score || 0) < 0.3) add(10, 'not_noisy');
  if (metrics.recent_review) add(5, 'recent_review');
  if ((metrics.avg_runtime_ms || 0) < 5) add(5, 'good_runtime');

  return { quality_score: Math.min(100, score), factors };
}

async function getRuleMetrics(tenantId = null) {
  let alertSql = `
    SELECT
      COALESCE(CAST(rule_id AS CHAR), title) AS rule_key,
      COUNT(*) AS alert_count,
      MAX(first_seen) AS last_fired
    FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE 1=1`;
  const params = [];
  if (tenantId != null) {
    alertSql += ' AND e.tenant_id = ?';
    params.push(tenantId);
  }
  alertSql += ' GROUP BY rule_key';
  const alertStats = await db.query(alertSql, params).catch(() => []);
  const byRule = new Map(alertStats.map((r) => [r.rule_key, r]));

  let qualitySql = `
    SELECT
      COALESCE(CAST(a.rule_id AS CHAR), a.title) AS rule_key,
      SUM(CASE WHEN dqe.analyst_disposition = 'true_positive' THEN 1 ELSE 0 END) AS tp,
      SUM(CASE WHEN dqe.analyst_disposition = 'false_positive' THEN 1 ELSE 0 END) AS fp
    FROM detection_quality_events dqe
    JOIN alerts a ON a.id = dqe.alert_id`;
  const qualityParams = [];
  if (tenantId != null) {
    qualitySql += ' JOIN endpoints e ON e.id = a.endpoint_id WHERE e.tenant_id = ?';
    qualityParams.push(tenantId);
  } else {
    qualitySql += ' WHERE 1=1';
  }
  qualitySql += ' GROUP BY rule_key';
  const qualityStats = await db.query(qualitySql, qualityParams).catch(() => []);

  const rules = loadRulesFromDisk();
  const items = rules.map((rule) => {
    const key = String(rule.id);
    const alerts = byRule.get(key) || {};
    const q = qualityStats.find((x) => x.rule_key === key) || {};
    const tp = Number(q.tp) || 0;
    const fp = Number(q.fp) || 0;
    const total = tp + fp;
    const metrics = {
      alert_count: Number(alerts.alert_count) || 0,
      last_fired: alerts.last_fired,
      false_positive_rate: total ? fp / total : null,
      noisy_score: Number(alerts.alert_count) > 100 ? 0.8 : 0.1,
    };
    const { quality_score, factors } = scoreRule(rule, metrics);
    return {
      rule_id: rule.id,
      name: rule.name,
      status: rule.status,
      severity: rule.severity,
      ...metrics,
      quality_score,
      quality_factors: factors,
      mitre_mapped: Boolean(rule.mitre?.techniques?.length || rule.mitre_technique),
      has_tests: hasTestFixture(rule, DETECTIONS_ROOT),
    };
  });

  items.sort((a, b) => b.quality_score - a.quality_score);

  return {
    rules: items,
    kpis: {
      total_rules: items.length,
      without_tests: items.filter((r) => !r.has_tests).length,
      without_mitre: items.filter((r) => !r.mitre_mapped).length,
      never_fired: items.filter((r) => !r.alert_count).length,
      top_noisy: items.filter((r) => r.alert_count > 50).slice(0, 10),
      needing_review: items.filter((r) => r.quality_score < 50).slice(0, 20),
      highest_value: items.filter((r) => r.quality_score >= 80).slice(0, 10),
    },
  };
}

module.exports = { getRuleMetrics, scoreRule };
