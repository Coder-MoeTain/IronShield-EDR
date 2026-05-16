/**
 * Detection-as-code engine — evaluates JSON rules from server-node/detections/
 */
const fs = require('fs');
const path = require('path');
const DetectionEngineService = require('./DetectionEngineService');

const DETECTIONS_ROOT = path.resolve(__dirname, '../../detections');

function loadRulesFromDisk() {
  const rules = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.json') && !name.startsWith('.')) {
        try {
          const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (raw.status === 'deprecated') continue;
          rules.push({ ...raw, _file: full });
        } catch {
          /* skip invalid */
        }
      }
    }
  }
  walk(path.join(DETECTIONS_ROOT, 'windows'));
  return rules;
}

function evalLogic(logic, norm) {
  if (!logic || typeof logic !== 'object') return false;
  if (logic.all && Array.isArray(logic.all)) {
    return logic.all.every((item) => evalLogic(item, norm));
  }
  if (logic.any && Array.isArray(logic.any)) {
    return logic.any.some((item) => evalLogic(item, norm));
  }
  if (logic.field && logic.op) {
    return evalFieldOp(logic, norm);
  }
  return DetectionEngineService.matchesRule({ conditions: logic }, norm);
}

function getField(norm, field) {
  const map = {
    event_type: norm.event_type,
    process_name: norm.process_name,
    command_line: norm.command_line || norm.powershell_command,
    process_path: norm.process_path,
    parent_process_name: norm.parent_process_name,
    registry_key: norm.registry_key,
    file_hash_sha256: norm.file_hash_sha256,
  };
  return map[field] ?? norm?.raw_event_json?.[field];
}

function evalFieldOp({ field, op, value }, norm) {
  const actual = String(getField(norm, field) ?? '');
  const expected = value;
  switch (op) {
    case 'eq':
      return actual.toLowerCase() === String(expected).toLowerCase();
    case 'contains':
      return actual.toLowerCase().includes(String(expected).toLowerCase());
    case 'starts_with':
      return actual.toLowerCase().startsWith(String(expected).toLowerCase());
    case 'ends_with':
      return actual.toLowerCase().endsWith(String(expected).toLowerCase());
    case 'regex':
      return new RegExp(expected, 'i').test(actual);
    case 'in':
      return Array.isArray(expected) && expected.some((v) => actual.toLowerCase() === String(v).toLowerCase());
    default:
      return false;
  }
}

function collectMatchedFields(logic, norm, path = 'logic', out = []) {
  if (!logic || typeof logic !== 'object') return out;
  if (logic.all && Array.isArray(logic.all)) {
    logic.all.forEach((item, i) => collectMatchedFields(item, norm, `${path}.all[${i}]`, out));
    return out;
  }
  if (logic.any && Array.isArray(logic.any)) {
    logic.any.forEach((item, i) => collectMatchedFields(item, norm, `${path}.any[${i}]`, out));
    return out;
  }
  if (logic.field && logic.op) {
    const actual = getField(norm, logic.field);
    if (evalFieldOp(logic, norm)) {
      out.push({
        field: logic.field,
        op: logic.op,
        expected: logic.value,
        actual: actual != null ? String(actual).substring(0, 500) : null,
        condition_path: path,
      });
    }
    return out;
  }
  return out;
}

function matchesCodeRule(rule, norm) {
  if (rule.event_types?.length) {
    const et = String(norm.event_type || '').toLowerCase();
    if (!rule.event_types.some((t) => et.includes(String(t).toLowerCase()))) return false;
  }
  if (rule.logic) return evalLogic(rule.logic, norm);
  if (rule.conditions) return DetectionEngineService.matchesRule({ conditions: rule.conditions }, norm);
  return false;
}

function evaluate(norm) {
  const rules = loadRulesFromDisk();
  const hits = [];
  for (const rule of rules) {
    if (rule.status === 'experimental' && process.env.DETECTIONS_INCLUDE_EXPERIMENTAL !== 'true') {
      continue;
    }
    if (matchesCodeRule(rule, norm)) {
      const matched = collectMatchedFields(rule.logic, norm);
      const risk = rule.risk_score || 50;
      hits.push({
        rule_id: rule.id,
        rule_name: rule.name,
        title: rule.name,
        description: rule.description,
        severity: rule.severity || 'medium',
        confidence: rule.confidence != null ? rule.confidence : risk / 100,
        mitre_tactic: rule.mitre?.tactics?.[0],
        mitre_technique: rule.mitre?.techniques?.[0],
        risk_score: risk,
        evidence: rule.logic || rule.conditions,
        detection_score_breakdown: {
          rule_id: rule.id,
          rule_name: rule.name,
          risk_score: risk,
          confidence: rule.confidence != null ? rule.confidence : risk / 100,
          severity: rule.severity,
          matched_fields: matched,
          mitre: rule.mitre,
        },
        evidence_summary: JSON.stringify({
          rule_id: rule.id,
          matched_fields: matched,
          logic: rule.logic,
        }),
      });
    }
  }
  return hits;
}

module.exports = { loadRulesFromDisk, evaluate, matchesCodeRule, evalLogic, collectMatchedFields };
