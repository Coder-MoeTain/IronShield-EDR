/**
 * Detection-as-code evaluation engine — logic operators, sequences, thresholds.
 */
const DetectionEngineService = require('../../services/DetectionEngineService');

const regexCache = new Map();
const ruleRuntimeStats = new Map();

function getCompiledRegex(pattern) {
  const key = pattern;
  if (!regexCache.has(key)) {
    try {
      regexCache.set(key, new RegExp(pattern, 'i'));
    } catch {
      regexCache.set(key, null);
    }
  }
  return regexCache.get(key);
}

/** Canonical + legacy field resolution from normalized event. */
function getField(norm, field) {
  const raw = norm?.raw_event_json || {};
  const dotMap = {
    'process.name': norm.process_name || raw.process_name,
    'process.command_line': norm.command_line || raw.command_line || raw.powershell_command,
    'process.path': norm.process_path || raw.process_path,
    'process.parent.name': norm.parent_process_name || raw.parent_process_name,
    'process.parent.path': raw.parent_process_path,
    'event_type': norm.event_type || raw.event_type,
    'user.name': raw.user_name || raw.user?.name,
    'endpoint.hostname': raw.hostname,
    'endpoint.id': norm.endpoint_id,
    'network.direction': raw.network_direction || raw.direction,
    'network.remote_ip': norm.destination_ip || raw.destination_ip,
    'file.path': raw.file_path || raw.target_filename,
    'file.hash': norm.file_hash_sha256 || raw.file_hash_sha256,
    'registry.key': norm.registry_key || raw.registry_key,
  };
  if (dotMap[field] !== undefined && dotMap[field] != null) return dotMap[field];
  const legacy = {
    process_name: norm.process_name,
    command_line: norm.command_line || norm.powershell_command,
    process_path: norm.process_path,
    parent_process_name: norm.parent_process_name,
    registry_key: norm.registry_key,
    file_hash_sha256: norm.file_hash_sha256,
    event_type: norm.event_type,
  };
  if (legacy[field] !== undefined) return legacy[field];
  return raw[field];
}

function toStr(v) {
  if (v == null) return '';
  return String(v);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function evalFieldOp({ field, op, value }, norm) {
  const actual = getField(norm, field);
  const opNorm = op === 'eq' ? 'equals' : op;
  const actualStr = toStr(actual);
  const actualLower = actualStr.toLowerCase();

  switch (opNorm) {
    case 'equals':
    case 'not_equals':
      return opNorm === 'equals'
        ? actualLower === toStr(value).toLowerCase()
        : actualLower !== toStr(value).toLowerCase();
    case 'contains':
    case 'not_contains':
      return opNorm === 'contains'
        ? actualLower.includes(toStr(value).toLowerCase())
        : !actualLower.includes(toStr(value).toLowerCase());
    case 'starts_with':
      return actualLower.startsWith(toStr(value).toLowerCase());
    case 'ends_with':
      return actualLower.endsWith(toStr(value).toLowerCase());
    case 'regex': {
      const re = getCompiledRegex(value);
      return re ? re.test(actualStr) : false;
    }
    case 'in':
    case 'not_in': {
      const arr = Array.isArray(value) ? value : [value];
      const hit = arr.some((v) => actualLower === toStr(v).toLowerCase());
      return opNorm === 'in' ? hit : !hit;
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const n = toNum(actual);
      const exp = toNum(value);
      if (n == null || exp == null) return false;
      if (opNorm === 'gt') return n > exp;
      if (opNorm === 'gte') return n >= exp;
      if (opNorm === 'lt') return n < exp;
      return n <= exp;
    }
    case 'between': {
      const n = toNum(actual);
      if (n == null || !Array.isArray(value) || value.length < 2) return false;
      return n >= toNum(value[0]) && n <= toNum(value[1]);
    }
    case 'is_true':
      return actual === true || actualLower === 'true' || actual === 1;
    case 'is_false':
      return actual === false || actualLower === 'false' || actual === 0;
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'not_exists':
      return actual === undefined || actual === null;
    case 'is_empty':
      return actual == null || actualStr.trim() === '';
    case 'is_not_empty':
      return actual != null && actualStr.trim() !== '';
    default:
      return false;
  }
}

function evalLogic(logic, norm) {
  if (!logic || typeof logic !== 'object') return false;
  if (logic.all && Array.isArray(logic.all)) {
    return logic.all.every((item) => evalLogic(item, norm));
  }
  if (logic.any && Array.isArray(logic.any)) {
    return logic.any.some((item) => evalLogic(item, norm));
  }
  if (logic.not) return !evalLogic(logic.not, norm);
  if (logic.field && logic.op) return evalFieldOp(logic, norm);
  if (logic.threshold || logic.sequence || logic.correlation) return false;
  return DetectionEngineService.matchesRule({ conditions: logic }, norm);
}

function collectMatchedConditions(logic, norm, path = 'logic', out = []) {
  if (!logic || typeof logic !== 'object') return out;
  if (logic.all) {
    logic.all.forEach((item, i) => collectMatchedConditions(item, norm, `${path}.all[${i}]`, out));
    return out;
  }
  if (logic.any) {
    logic.any.forEach((item, i) => collectMatchedConditions(item, norm, `${path}.any[${i}]`, out));
    return out;
  }
  if (logic.not) {
    collectMatchedConditions(logic.not, norm, `${path}.not`, out);
    return out;
  }
  if (logic.field && logic.op) {
    const actual = getField(norm, logic.field);
    const matched = evalFieldOp(logic, norm);
    out.push({
      field: logic.field,
      operator: logic.op,
      expected: logic.value,
      actual: actual != null ? toStr(actual).substring(0, 500) : null,
      matched,
      condition_path: path,
    });
    return out;
  }
  return out;
}

function eventTypeMatches(rule, norm) {
  if (!rule.event_types?.length) return true;
  const et = toStr(norm.event_type).toLowerCase();
  return rule.event_types.some((t) => et.includes(toStr(t).toLowerCase()));
}

function matchesRule(rule, norm) {
  if (!eventTypeMatches(rule, norm)) return false;
  if (rule.logic?.threshold || rule.logic?.sequence || rule.logic?.correlation) {
    return false;
  }
  if (rule.logic) return evalLogic(rule.logic, norm);
  if (rule.conditions) return DetectionEngineService.matchesRule({ conditions: rule.conditions }, norm);
  return false;
}

function recordRuleRuntime(ruleId, ms, error = null) {
  const cur = ruleRuntimeStats.get(ruleId) || { count: 0, totalMs: 0, errors: 0, maxMs: 0 };
  cur.count += 1;
  cur.totalMs += ms;
  cur.maxMs = Math.max(cur.maxMs, ms);
  if (error) cur.errors += 1;
  ruleRuntimeStats.set(ruleId, cur);
}

function evaluate(norm, rules, opts = {}) {
  const hits = [];
  const eventType = toStr(norm.event_type).toLowerCase();
  const candidates = rules.filter((r) => {
    if (!r.enabled && r.enabled !== undefined) return false;
    if (r.status === 'experimental' && process.env.DETECTIONS_INCLUDE_EXPERIMENTAL !== 'true') {
      return false;
    }
    if (r.event_types?.length) {
      return r.event_types.some((t) => eventType.includes(toStr(t).toLowerCase()));
    }
    return true;
  });

  for (const rule of candidates) {
    const t0 = Date.now();
    let matched = false;
    let err = null;
    try {
      matched = matchesRule(rule, norm);
    } catch (e) {
      err = e;
      matched = false;
    }
    recordRuleRuntime(rule.id, Date.now() - t0, err);
    if (!matched) continue;

    const conditions = collectMatchedConditions(rule.logic, norm);
    const matchedOnly = conditions.filter((c) => c.matched);
    hits.push({
      rule,
      rule_id: rule.id,
      rule_name: rule.name,
      title: rule.name,
      description: rule.description,
      severity: rule.severity || 'medium',
      confidence: rule.confidence != null ? rule.confidence / 100 : 0.7,
      mitre_tactic: rule.mitre?.tactics?.[0] || rule.mitre_tactic,
      mitre_technique:
        typeof rule.mitre?.techniques?.[0] === 'object'
          ? rule.mitre.techniques[0].id
          : rule.mitre?.techniques?.[0] || rule.mitre_technique,
      risk_score: rule.risk_score || 50,
      matched_conditions: matchedOnly.length ? matchedOnly : conditions,
      explain: rule.explain,
    });
  }
  return hits;
}

function getRuleRuntimeStats() {
  const out = {};
  for (const [id, s] of ruleRuntimeStats) {
    out[id] = { ...s, avgMs: s.count ? s.totalMs / s.count : 0 };
  }
  return out;
}

function clearRegexCache() {
  regexCache.clear();
}

module.exports = {
  getField,
  evalLogic,
  evalFieldOp,
  collectMatchedConditions,
  matchesRule,
  evaluate,
  getRuleRuntimeStats,
  clearRegexCache,
  getCompiledRegex,
};
