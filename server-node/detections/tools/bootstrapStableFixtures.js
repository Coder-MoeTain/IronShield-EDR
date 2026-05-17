#!/usr/bin/env node
/**
 * Generate benign/malicious fixtures and professional metadata for stable IRN-WIN rules.
 * Run: node detections/tools/bootstrapStableFixtures.js
 */
const fs = require('fs');
const path = require('path');
const { loadRulesFromDisk, DETECTIONS_ROOT } = require('../../src/modules/detections/ruleLoader');
const { hasTestFixture } = require('../../src/modules/detections/ruleValidator');

const FIXTURES = path.join(DETECTIONS_ROOT, 'tests', 'fixtures');

function walkLogic(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.all) node.all.forEach((n) => walkLogic(n, out));
  if (node.any) node.any.forEach((n) => walkLogic(n, out));
  if (node.not) walkLogic(node.not, out);
  if (node.field && node.value != null && ['contains', 'equals', 'starts_with'].includes(node.op)) {
    out.push({ field: node.field, value: String(node.value), op: node.op });
  }
  return out;
}

function fieldToEventKey(field) {
  const map = {
    'process.name': 'process_name',
    process_name: 'process_name',
    'process.command_line': 'command_line',
    command_line: 'command_line',
    'process.parent.name': 'parent_process_name',
    parent_process_name: 'parent_process_name',
    event_type: 'event_type',
  };
  return map[field] || field.replace(/\./g, '_');
}

function buildMaliciousEvent(rule, hints) {
  const evt = {
    event_id: `evt-${rule.id}-mal`,
    event_type: (rule.event_types && rule.event_types[0]) || 'process_create',
    event_time: '2026-05-17T12:00:00Z',
    endpoint_id: 1,
    process_name: 'cmd.exe',
    command_line: 'cmd.exe /c echo benign',
  };
  for (const h of hints) {
    const key = fieldToEventKey(h.field);
    if (h.op === 'contains' || h.op === 'starts_with') {
      evt[key] = h.value.includes('.exe') ? h.value : `${h.value}-trigger`;
    } else {
      evt[key] = h.value;
    }
  }
  return evt;
}

function buildBenignEvent(rule) {
  return {
    event_id: `evt-${rule.id}-benign`,
    event_type: (rule.event_types && rule.event_types[0]) || 'process_create',
    event_time: '2026-05-17T12:00:00Z',
    endpoint_id: 1,
    process_name: 'notepad.exe',
    command_line: 'notepad.exe C:\\temp\\readme.txt',
  };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeFixture(subdir, name, body) {
  const dir = path.join(FIXTURES, subdir);
  ensureDir(dir);
  const file = path.join(dir, `${name}.json`);
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return true;
}

function enrichRuleFile(rule) {
  const raw = JSON.parse(fs.readFileSync(rule._file, 'utf8'));
  let changed = false;
  const benignId = `${rule.id}-benign-001`;
  const maliciousId = `${rule.id}-malicious-001`;
  const today = '2026-05-17';

  if (!raw.false_positives?.length) {
    raw.false_positives = ['Legitimate administrative activity on managed endpoints'];
    changed = true;
  }
  if (!raw.response_guidance?.length) {
    raw.response_guidance = [
      'Review parent process and user context.',
      'Correlate with network and file events on the endpoint.',
    ];
    changed = true;
  }
  if (!raw.data_sources?.length) {
    raw.data_sources = ['process_creation'];
    changed = true;
  }
  if (raw.confidence == null) {
    raw.confidence = 75;
    changed = true;
  }
  const folderCat = rule._category_folder?.replace(/\.json$/, '');
  if ((!raw.category || String(raw.category).includes('.json')) && folderCat) {
    raw.category = folderCat;
    changed = true;
  }
  if (!raw.created_at) {
    raw.created_at = today;
    changed = true;
  }
  if (!raw.updated_at) {
    raw.updated_at = today;
    changed = true;
  }
  if (!raw.explain?.summary) {
    raw.explain = {
      summary: raw.description || rule.name,
      matched_fields: walkLogic(raw.logic).map((h) => h.field),
    };
    changed = true;
  }
  if (!raw.tests?.length) {
    raw.tests = [benignId, maliciousId];
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(rule._file, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  }
  return changed;
}

function main() {
  const rules = loadRulesFromDisk().filter((r) => r.status === 'stable');
  let created = 0;
  let enriched = 0;

  for (const rule of rules) {
    const hints = walkLogic(rule.logic);
    if (enrichRuleFile(rule)) enriched += 1;

    if (hasTestFixture(rule, DETECTIONS_ROOT)) continue;

    const benignId = `${rule.id}-benign-001`;
    const maliciousId = `${rule.id}-malicious-001`;

    if (
      writeFixture('benign', benignId, {
        id: benignId,
        description: `Benign control for ${rule.id}`,
        events: [buildBenignEvent(rule)],
        expected_no_alerts: true,
        must_not_match: [rule.id],
      })
    ) {
      created += 1;
    }

    if (
      writeFixture('malicious', maliciousId, {
        id: maliciousId,
        description: `Malicious sample for ${rule.id}`,
        events: [buildMaliciousEvent(rule, hints)],
        must_match: [rule.id],
        expected_alerts: [{ rule_id: rule.id, require_explanation: false }],
      })
    ) {
      created += 1;
    }

  }

  console.log(`bootstrapStableFixtures: ${created} fixture file(s) created, ${enriched} rule(s) enriched`);
}

main();
