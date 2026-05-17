/**
 * Detection engineering constants — MITRE tactics, severities, operators.
 */
const MITRE_TACTICS = Object.freeze([
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
]);

const CATEGORY_CODES = Object.freeze({
  execution: 'EXE',
  persistence: 'PER',
  privilege_escalation: 'PE',
  defense_evasion: 'DEF',
  credential_access: 'CRE',
  discovery: 'DIS',
  lateral_movement: 'LAT',
  collection: 'COL',
  command_and_control: 'C2',
  exfiltration: 'EXF',
  impact: 'IMP',
  initial_access: 'INI',
});

const SEVERITY_RISK_RANGES = Object.freeze({
  informational: [0, 20],
  low: [21, 40],
  medium: [41, 60],
  high: [61, 80],
  critical: [81, 100],
});

const SEVERITY_BASE_RISK = Object.freeze({
  informational: 10,
  low: 25,
  medium: 45,
  high: 70,
  critical: 90,
});

const STRING_OPS = new Set([
  'equals',
  'eq',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'regex',
  'in',
  'not_in',
]);

const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);
const BOOLEAN_OPS = new Set(['is_true', 'is_false']);
const EXISTENCE_OPS = new Set(['exists', 'not_exists', 'is_empty', 'is_not_empty']);

const OFFENSIVE_PATTERNS = [
  /\b(exploit|payload|shellcode|mimikatz\s+sekurlsa|pass-the-hash\s+tool)\b/i,
  /\b(bypass\s+av|disable\s+defender\s+permanently|exfiltrate\s+credentials)\b/i,
];

module.exports = {
  MITRE_TACTICS,
  CATEGORY_CODES,
  SEVERITY_RISK_RANGES,
  SEVERITY_BASE_RISK,
  STRING_OPS,
  NUMERIC_OPS,
  BOOLEAN_OPS,
  EXISTENCE_OPS,
  OFFENSIVE_PATTERNS,
};
