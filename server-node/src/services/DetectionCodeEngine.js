/**
 * Detection-as-code engine — evaluates JSON rules from server-node/detections/
 */
const { loadRulesFromDisk } = require('../modules/detections/ruleLoader');
const detectionEngine = require('../modules/detections/detectionEngine');
const { buildExplanation } = require('../modules/detections/alertExplainabilityService');

function evaluate(norm) {
  const rules = loadRulesFromDisk();
  const rawHits = detectionEngine.evaluate(norm, rules);
  return rawHits.map((hit) => {
    const explanation = buildExplanation(hit.rule, hit.matched_conditions, {});
    return {
      rule_id: hit.rule_id,
      rule_name: hit.rule_name,
      title: hit.title,
      description: hit.description,
      severity: hit.severity,
      confidence: explanation.confidence,
      mitre_tactic: hit.mitre_tactic,
      mitre_technique: hit.mitre_technique,
      risk_score: explanation.risk_score,
      evidence: hit.rule.logic || hit.rule.conditions,
      detection_score_breakdown: explanation.detection_score_breakdown,
      evidence_summary: JSON.stringify({
        rule_id: hit.rule_id,
        summary: explanation.summary,
        matched_conditions: explanation.matched_conditions,
        risk_breakdown: explanation.risk_breakdown,
        confidence_breakdown: explanation.confidence_breakdown,
        mitre: explanation.mitre,
        recommended_triage: explanation.recommended_triage,
        false_positive_notes: explanation.false_positive_notes,
      }),
      why_fired: explanation,
    };
  });
}

module.exports = {
  loadRulesFromDisk,
  evaluate,
  matchesCodeRule: (rule, norm) => detectionEngine.matchesRule(rule, norm),
  evalLogic: detectionEngine.evalLogic,
  collectMatchedFields: (logic, norm) =>
    detectionEngine.collectMatchedConditions(logic, norm).filter((c) => c.matched),
};
