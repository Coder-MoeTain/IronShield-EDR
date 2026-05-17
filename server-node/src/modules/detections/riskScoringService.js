/**
 * Professional alert risk and confidence scoring.
 */
const { SEVERITY_BASE_RISK } = require('./constants');

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function computeRiskScore(alertContext = {}, rule = {}) {
  const factors = [];
  let score = SEVERITY_BASE_RISK[rule.severity || alertContext.severity] ?? 45;

  if (rule.risk_score != null) {
    score = (score + Number(rule.risk_score)) / 2;
    factors.push({ factor: 'Rule base risk', points: Math.round(rule.risk_score) });
  } else {
    factors.push({ factor: 'Severity baseline', points: Math.round(score) });
  }

  const mods = [
    ['Asset criticality', alertContext.asset_criticality, 20],
    ['Privileged user', alertContext.privileged_user, 10],
    ['Unsigned binary', alertContext.unsigned_binary, 10],
    ['Suspicious parent-child', alertContext.suspicious_parent_child, 15],
    ['IOC match', alertContext.ioc_match, 20],
    ['Rare process path', alertContext.rare_process_path, 10],
    ['Rare external destination', alertContext.rare_external_destination, 15],
    ['Repeated alert', alertContext.repeated_alert, 5],
    ['Correlated alert chain', alertContext.correlated_alert_chain, 20],
    ['Suppression match', alertContext.suppression_match, -30],
    ['Known good allowlist', alertContext.known_good_allowlist, -50],
    ['Noisy rule penalty', alertContext.noisy_rule, -10],
  ];

  for (const [name, active, pts] of mods) {
    if (active) {
      score += pts;
      factors.push({ factor: name, points: pts });
    }
  }

  for (const rf of rule.explain?.risk_factors || []) {
    if (rf.points) {
      score += rf.points;
      factors.push({ factor: rf.name || 'Rule risk factor', points: rf.points });
    }
  }

  return { risk_score: clamp(Math.round(score)), risk_breakdown: factors };
}

function computeConfidence(matchedConditions = [], rule = {}, alertContext = {}) {
  const factors = [];
  let score = rule.confidence != null ? Number(rule.confidence) : 70;

  const strong = matchedConditions.filter((c) => c.matched && ['equals', 'regex', 'in'].includes(c.operator));
  const weak = matchedConditions.filter((c) => c.matched && ['contains', 'starts_with'].includes(c.operator));

  if (strong.length) factors.push({ factor: 'Strong field match', points: 50 });
  if (weak.length && !strong.length) factors.push({ factor: 'Keyword match only', points: 25 });
  if (alertContext.ioc_match) factors.push({ factor: 'IOC match', points: 30 });
  if (alertContext.sequence_match) factors.push({ factor: 'Sequence match', points: 40 });
  if (alertContext.missing_critical_fields) {
    score -= 15;
    factors.push({ factor: 'Missing critical fields', points: -15 });
  }

  if (rule.status === 'experimental') score = Math.min(score, 60);

  const confidence = clamp(Math.round((score + factors.reduce((s, f) => s + (f.points || 0), 0) * 0.1) / 100 * 100));
  return {
    confidence: confidence / 100,
    confidence_breakdown: factors,
    confidence_score: confidence,
  };
}

module.exports = { computeRiskScore, computeConfidence, clamp };
