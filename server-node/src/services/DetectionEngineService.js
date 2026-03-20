/**
 * Rule-based detection engine - evaluates normalized events against rules
 * Phase B: JSON/Sigma-style rule engine - conditions from DB are evaluated dynamically
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

async function getEnabledRules() {
  return db.query('SELECT * FROM detection_rules WHERE enabled = 1');
}

/**
 * Evaluate a single condition key against normalized event
 */
function evalCondition(key, value, norm) {
  const str = (s) => (s == null ? '' : String(s));
  const cmd = str(norm.command_line) + str(norm.powershell_command);
  const path = str(norm.process_path) + str(norm.command_line);
  const proc = (norm.process_name || '').toLowerCase();
  const parent = (norm.parent_process_name || '').toUpperCase();

  switch (key) {
    case 'event_type':
      if (Array.isArray(value)) return value.some(v => str(norm.event_type).toLowerCase().includes(String(v).toLowerCase()));
      const v = String(value).toLowerCase();
      const et = str(norm.event_type).toLowerCase();
      if (v === 'service_create') return et.includes('service');
      return et.includes(v);
    case 'process_name':
      if (Array.isArray(value)) return value.some(v => proc.includes(String(v).toLowerCase()));
      return proc.includes(String(value).toLowerCase());
    case 'parent_process':
      if (!Array.isArray(value)) return false;
      return value.some(v => parent.includes(String(v).toUpperCase()));
    case 'child_process':
      if (!Array.isArray(value)) return false;
      return value.some(v => proc.includes(String(v).toLowerCase()));
    case 'encoded_command':
      return value === true && (/powershell\.exe/i.test(proc) &&
        (/-enc\b|-encodedcommand\b|FromBase64String/i.test(cmd) || /^[A-Za-z0-9+/=]{20,}$/.test(cmd)));
    case 'suspicious_params':
      if (value !== true) return false;
      if (/rundll32\.exe/i.test(proc)) return cmd.length > 100;
      if (/wscript\.exe|cscript\.exe/i.test(proc)) return cmd.length > 80;
      if (/regsvr32\.exe/i.test(proc)) return cmd.length > 60;
      if (/mshta\.exe/i.test(proc)) return cmd.length > 50;
      return false;
    case 'path_contains':
      if (!Array.isArray(value)) return false;
      const pathUpper = path.toUpperCase();
      return value.some(v => pathUpper.includes(String(v).toUpperCase()));
    case 'unusual_parent':
      return value === true && (norm.event_type || '').includes('service') &&
        !/services\.exe|svchost\.exe/i.test(norm.parent_process_name || '');
    case 'signed':
      return value === false && path.toLowerCase().includes('\\users\\') && !norm.file_hash_sha256;
    default:
      return true;
  }
}

/**
 * Evaluate JSON conditions against normalized event (Sigma-style)
 */
function evaluateConditions(conditions, norm) {
  if (!conditions || typeof conditions !== 'object') return false;
  for (const [key, value] of Object.entries(conditions)) {
    if (!evalCondition(key, value, norm)) return false;
  }
  return true;
}

function matchesRule(rule, norm) {
  const cond = rule.conditions;
  if (cond && typeof cond === 'object' && Object.keys(cond).length > 0) {
    return evaluateConditions(cond, norm);
  }
  return false;
}

async function evaluateAndAlert(normalizedEvent) {
  const rules = await getEnabledRules();
  const alerts = [];

  for (const rule of rules) {
    if (matchesRule(rule, normalizedEvent)) {
      alerts.push({
        endpoint_id: normalizedEvent.endpoint_id,
        rule_id: rule.id,
        title: rule.title,
        description: rule.description || `Rule ${rule.name} matched`,
        severity: rule.severity || 'medium',
        confidence: 0.85,
        mitre_tactic: rule.mitre_tactic,
        mitre_technique: rule.mitre_technique,
        source_event_ids: JSON.stringify([normalizedEvent.raw_event_id]),
        first_seen: normalizedEvent.timestamp,
        last_seen: normalizedEvent.timestamp,
      });
    }
  }

  return alerts;
}

module.exports = { evaluateAndAlert, matchesRule };
