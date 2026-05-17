/**
 * Strict detection rule validation for CI and authoring.
 */
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const {
  MITRE_TACTICS,
  CATEGORY_CODES,
  SEVERITY_RISK_RANGES,
  OFFENSIVE_PATTERNS,
} = require('./constants');
const { loadRulesFromDisk, isProfessionalRule } = require('./ruleLoader');
const { getCompiledRegex } = require('./detectionEngine');

const techniqueSchema = z.union([
  z.string().regex(/^T\d{4}(\.\d{3})?$/),
  z.object({ id: z.string().regex(/^T\d{4}(\.\d{3})?$/), name: z.string().optional() }),
]);

const professionalRuleSchema = z.object({
  id: z.string().min(5),
  name: z.string().min(8),
  description: z.string().min(20),
  status: z.enum(['experimental', 'test', 'stable', 'deprecated', 'disabled']),
  enabled: z.boolean(),
  severity: z.enum(['informational', 'low', 'medium', 'high', 'critical']),
  risk_score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  platform: z.enum(['windows', 'linux', 'macos', 'xdr', 'cloud', 'identity', 'network']),
  data_sources: z.array(z.string()).min(1),
  event_types: z.array(z.string()).min(1),
  category: z.string(),
  mitre: z.object({
    tactics: z.array(z.string()),
    techniques: z.array(techniqueSchema).min(1),
  }),
  logic: z.record(z.unknown()),
  explain: z.object({
    summary: z.string(),
    matched_fields: z.array(z.string()).optional(),
    risk_factors: z.array(z.unknown()).optional(),
  }),
  false_positives: z.array(z.string()),
  response_guidance: z.array(z.string()).min(1),
  author: z.string(),
  version: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  tests: z.array(z.string()),
});

const legacyRequired = ['id', 'name', 'severity', 'platform'];

function scanOffensiveContent(rule) {
  const blob = JSON.stringify(rule);
  for (const pat of OFFENSIVE_PATTERNS) {
    if (pat.test(blob)) return `Suspicious offensive wording detected in rule ${rule.id}`;
  }
  return null;
}

function validateRegexInLogic(logic, errors, prefix = 'logic') {
  if (!logic || typeof logic !== 'object') return;
  if (logic.all) logic.all.forEach((x, i) => validateRegexInLogic(x, errors, `${prefix}.all[${i}]`));
  if (logic.any) logic.any.forEach((x, i) => validateRegexInLogic(x, errors, `${prefix}.any[${i}]`));
  if (logic.not) validateRegexInLogic(logic.not, errors, `${prefix}.not`);
  if (logic.field && logic.op === 'regex') {
    const re = getCompiledRegex(logic.value);
    if (!re) errors.push(`${prefix}: invalid regex ${logic.value}`);
  }
  if (logic.threshold) {
    if (!logic.threshold.group_by?.length) errors.push(`${prefix}.threshold: group_by required`);
    if (!logic.threshold.count || logic.threshold.count < 1) errors.push(`${prefix}.threshold: count required`);
    if (!logic.threshold.time_window_minutes) errors.push(`${prefix}.threshold: time_window_minutes required`);
  }
  if (logic.sequence) {
    if (!logic.sequence.time_window_minutes) errors.push(`${prefix}.sequence: time_window_minutes required`);
    if (!logic.sequence.steps?.length) errors.push(`${prefix}.sequence: steps required`);
  }
}

function categoryMatchesFolder(rule) {
  if (!rule._category_folder || !rule.category) return true;
  const folder = rule._category_folder.replace(/-/g, '_');
  const cat = String(rule.category).replace(/-/g, '_');
  return folder === cat || rule.id.includes(CATEGORY_CODES[cat] || 'XXXX');
}

function hasTestFixture(rule, detectionsRoot) {
  const testsDir = path.join(detectionsRoot, 'tests', 'fixtures');
  const patterns = [
    ...(rule.tests || []),
    `${rule.id}-benign`,
    `${rule.id}-malicious`,
    rule.id,
  ];
  const roots = [testsDir, path.join(testsDir, 'benign'), path.join(testsDir, 'malicious')];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const f of fs.readdirSync(root)) {
      if (!f.endsWith('.json')) continue;
      const base = f.replace(/\.json$/, '');
      if (patterns.some((p) => base === p || base.startsWith(`${rule.id}-`))) return true;
    }
  }
  return (rule.tests || []).length > 0;
}

function validateRules(opts = {}) {
  const detectionsRoot = path.resolve(__dirname, '../../../detections');
  const rules = loadRulesFromDisk();
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const names = new Set();
  const stats = {
    total: rules.length,
    stable: 0,
    experimental: 0,
    deprecated: 0,
    with_tests: 0,
    without_tests: 0,
    mitre_mapped: 0,
    invalid: 0,
    professional: 0,
  };

  for (const rule of rules) {
    const file = rule._file || rule.id;
    if (ids.has(rule.id)) errors.push(`Duplicate rule ID: ${rule.id}`);
    ids.add(rule.id);
    if (names.has(rule.name)) warnings.push(`Duplicate rule name: ${rule.name}`);
    names.add(rule.name);

    if (rule.status === 'stable') stats.stable += 1;
    if (rule.status === 'experimental') stats.experimental += 1;
    if (rule.status === 'deprecated') stats.deprecated += 1;

    const offensive = scanOffensiveContent(rule);
    if (offensive) errors.push(offensive);

    for (const k of legacyRequired) {
      if (!rule[k]) errors.push(`[${file}] missing required field: ${k}`);
    }

    if (isProfessionalRule(rule)) {
      stats.professional += 1;
      const parsed = professionalRuleSchema.safeParse(rule);
      if (!parsed.success) {
        parsed.error.issues.forEach((i) => errors.push(`[${rule.id}] ${i.path.join('.')}: ${i.message}`));
      }
      for (const t of rule.mitre?.tactics || []) {
        if (!MITRE_TACTICS.includes(t)) warnings.push(`[${rule.id}] non-standard MITRE tactic: ${t}`);
      }
      const [minR, maxR] = SEVERITY_RISK_RANGES[rule.severity] || [0, 100];
      if (rule.risk_score < minR || rule.risk_score > maxR) {
        warnings.push(`[${rule.id}] risk_score ${rule.risk_score} outside ${rule.severity} range ${minR}-${maxR}`);
      }
      if (rule.status === 'stable') {
        if (!rule.false_positives?.length) errors.push(`[${rule.id}] stable rule missing false_positives`);
        if (!rule.response_guidance?.length) errors.push(`[${rule.id}] stable rule missing response_guidance`);
        if (!rule.tests?.length && !hasTestFixture(rule, detectionsRoot)) {
          errors.push(`[${rule.id}] stable professional rule missing tests`);
        }
      }
    } else if (rule.status === 'stable' && opts.strictLegacy !== false) {
      if (!hasTestFixture(rule, detectionsRoot)) {
        warnings.push(`[${rule.id}] legacy stable rule has no test fixture (grandfathered)`);
      }
    }

    if (rule.mitre?.techniques?.length || rule.mitre_technique) stats.mitre_mapped += 1;
    if (hasTestFixture(rule, detectionsRoot)) stats.with_tests += 1;
    else stats.without_tests += 1;

    if (!categoryMatchesFolder(rule)) {
      warnings.push(`[${rule.id}] category may not match folder ${rule._category_folder}`);
    }

    validateRegexInLogic(rule.logic, errors, `${rule.id}.logic`);
  }

  stats.invalid = errors.length;
  return { ok: errors.length === 0, errors, warnings, stats, rules };
}

module.exports = { validateRules, professionalRuleSchema, hasTestFixture };
