/**
 * Build full alert explanation payload for storage and UI.
 */
const { computeRiskScore, computeConfidence } = require('./riskScoringService');

function buildExplanation(rule, matchedConditions = [], alertContext = {}) {
  const { risk_score, risk_breakdown } = computeRiskScore(alertContext, rule);
  const { confidence, confidence_breakdown, confidence_score } = computeConfidence(
    matchedConditions,
    rule,
    alertContext
  );

  const techniques = (rule.mitre?.techniques || []).map((t) =>
    typeof t === 'object' ? t.id : t
  );

  return {
    summary: rule.explain?.summary || rule.description,
    matched_rule: {
      id: rule.id,
      name: rule.name,
      version: rule.version || '1.0.0',
    },
    matched_conditions: matchedConditions,
    risk_breakdown,
    confidence_breakdown,
    mitre: {
      tactics: rule.mitre?.tactics || [],
      techniques,
    },
    recommended_triage: rule.response_guidance || [],
    false_positive_notes: rule.false_positives || [],
    risk_score,
    confidence,
    confidence_score,
    detection_score_breakdown: {
      rule_id: rule.id,
      rule_name: rule.name,
      version: rule.version,
      risk_score,
      confidence: confidence_score,
      severity: rule.severity,
      matched_fields: matchedConditions.filter((c) => c.matched),
      risk_factors: risk_breakdown,
      confidence_factors: confidence_breakdown,
      mitre: rule.mitre,
    },
  };
}

module.exports = { buildExplanation };
