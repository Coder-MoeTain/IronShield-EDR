/**
 * Detection rule quality linter — warnings for SOC engineering hygiene.
 */
const { SEVERITY_RISK_RANGES, OFFENSIVE_PATTERNS } = require('./constants');
const { loadRulesFromDisk, isProfessionalRule } = require('./ruleLoader');
const { hasTestFixture } = require('./ruleValidator');
const path = require('path');

const GENERIC_NAMES = /^(suspicious|malicious|detect|alert)\s/i;
const BROAD_REGEX = /^\.{0,2}\*?$/;

function lintRules() {
  const detectionsRoot = path.resolve(__dirname, '../../../detections');
  const rules = loadRulesFromDisk();
  const findings = [];
  const logicHashes = new Map();

  for (const rule of rules) {
    const add = (code, msg, severity = 'warn') => findings.push({ rule_id: rule.id, code, message: msg, severity });

    if (GENERIC_NAMES.test(rule.name)) add('generic_name', 'Rule name may be too generic');
    if ((rule.description || '').length < 40) add('short_description', 'Description is short; add analyst context');
    if (!rule.false_positives?.length) add('no_false_positives', 'Missing false positive guidance');
    if (!rule.response_guidance?.length) add('no_response_guidance', 'Missing analyst response guidance');
    if (!rule.mitre?.techniques?.length && !rule.mitre_technique) add('no_mitre', 'Missing MITRE mapping');
    if (!hasTestFixture(rule, detectionsRoot)) add('no_tests', 'No test fixtures referenced');
    if (!rule.data_sources?.length) add('no_data_sources', 'Missing data_sources declaration');

    const logicStr = JSON.stringify(rule.logic || {});
    if (logicHashes.has(logicStr)) {
      add('duplicate_logic', `Similar logic to ${logicHashes.get(logicStr)}`);
    } else {
      logicHashes.set(logicStr, rule.id);
    }

    const [minR, maxR] = SEVERITY_RISK_RANGES[rule.severity] || [0, 100];
    if (rule.risk_score != null && (rule.risk_score < minR || rule.risk_score > maxR)) {
      add('risk_severity_mismatch', `risk_score ${rule.risk_score} not aligned with ${rule.severity} (${minR}-${maxR})`);
    }
    if (rule.status === 'experimental' && rule.confidence > 85) {
      add('high_confidence_experimental', 'Confidence too high for experimental rule');
    }
    if (rule.severity === 'critical' && rule.risk_score < 81) {
      add('excessive_severity', 'Critical severity with low risk_score');
    }

    function scanLogic(logic) {
      if (!logic) return;
      if (logic.all) logic.all.forEach(scanLogic);
      if (logic.any) logic.any.forEach(scanLogic);
      if (logic.field && logic.op === 'regex' && BROAD_REGEX.test(String(logic.value))) {
        add('broad_regex', `Overly broad regex on ${logic.field}`);
      }
      if (logic.field && logic.op === 'contains' && String(logic.value).length < 3) {
        add('weak_match', `Weak keyword-only match on ${logic.field}`);
      }
    }
    scanLogic(rule.logic);

    const blob = JSON.stringify(rule);
    for (const pat of OFFENSIVE_PATTERNS) {
      if (pat.test(blob)) add('offensive_wording', 'Rule text may contain offensive/instructional wording', 'error');
    }
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  return { ok: errors === 0, findings, error_count: errors, warning_count: findings.length - errors };
}

module.exports = { lintRules };
