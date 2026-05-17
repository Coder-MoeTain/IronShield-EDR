/**
 * Load detection-as-code rules from disk (windows/, xdr/, packs/).
 */
const fs = require('fs');
const path = require('path');

const DETECTIONS_ROOT = path.resolve(__dirname, '../../../detections');
const RULE_DIRS = ['windows', 'xdr'];

function walkJsonRules(dir, rules, relBase) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walkJsonRules(full, rules, relBase);
    } else if (name.endsWith('.json') && !name.startsWith('.')) {
      try {
        const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (raw.status === 'deprecated' || raw.status === 'disabled') continue;
        if (raw.enabled === false) continue;
        const rel = path.relative(relBase, full).replace(/\\/g, '/');
        const category = rel.split('/')[1] || null;
        rules.push({
          ...raw,
          _file: full,
          _category_folder: category,
          enabled: raw.enabled !== false,
        });
      } catch {
        /* skip invalid JSON */
      }
    }
  }
}

function loadRulesFromDisk(opts = {}) {
  const rules = [];
  for (const sub of RULE_DIRS) {
    walkJsonRules(path.join(DETECTIONS_ROOT, sub), rules, path.join(DETECTIONS_ROOT, sub));
  }
  if (opts.packId) {
    const pack = loadPack(opts.packId);
    if (pack?.rules?.length) {
      const idSet = new Set(pack.rules);
      return rules.filter((r) => idSet.has(r.id));
    }
  }
  return rules;
}

function loadPack(packId) {
  const packPath = path.join(DETECTIONS_ROOT, 'packs', `${packId}.json`);
  if (!fs.existsSync(packPath)) {
    const alt = path.join(DETECTIONS_ROOT, 'packs', packId.endsWith('.json') ? packId : `${packId}.json`);
    if (!fs.existsSync(alt)) return null;
    return JSON.parse(fs.readFileSync(alt, 'utf8'));
  }
  return JSON.parse(fs.readFileSync(packPath, 'utf8'));
}

function loadAllPacks() {
  const packsDir = path.join(DETECTIONS_ROOT, 'packs');
  if (!fs.existsSync(packsDir)) return [];
  return fs
    .readdirSync(packsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8')));
}

function loadTestCases() {
  const cases = [];
  const roots = [
    path.join(DETECTIONS_ROOT, 'tests', 'fixtures'),
    path.join(DETECTIONS_ROOT, 'tests', 'fixtures', 'benign'),
    path.join(DETECTIONS_ROOT, 'tests', 'fixtures', 'malicious'),
    path.join(DETECTIONS_ROOT, 'tests', 'fixtures', 'suspicious'),
    path.join(DETECTIONS_ROOT, 'tests', 'fixtures', 'noisy'),
  ];
  const seen = new Set();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const f of fs.readdirSync(root)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(root, f);
      if (seen.has(full)) continue;
      seen.add(full);
      try {
        cases.push({ ...JSON.parse(fs.readFileSync(full, 'utf8')), _file: full });
      } catch {
        /* skip */
      }
    }
  }
  return cases;
}

function isProfessionalRule(rule) {
  return Boolean(rule.explain && rule.data_sources && rule.response_guidance);
}

module.exports = {
  DETECTIONS_ROOT,
  loadRulesFromDisk,
  loadPack,
  loadAllPacks,
  loadTestCases,
  isProfessionalRule,
};
