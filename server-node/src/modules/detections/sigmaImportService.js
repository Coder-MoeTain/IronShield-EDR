/**
 * Sigma rule import — draft IronShield rules only (manual review required).
 */
const SIGMA_FIELD_MAP = {
  Image: 'process.path',
  CommandLine: 'process.command_line',
  ParentImage: 'process.parent.path',
  ParentCommandLine: 'process.parent.command_line',
  EventID: 'event.code',
  User: 'user.name',
  DestinationIp: 'network.remote_ip',
  DestinationPort: 'network.remote_port',
  TargetFilename: 'file.path',
  ProcessName: 'process.name',
  ParentProcessName: 'process.parent.name',
};

function mapSigmaField(sigmaField) {
  return SIGMA_FIELD_MAP[sigmaField] || sigmaField.toLowerCase().replace(/\s+/g, '_');
}

function sigmaSelectionToLogic(selection) {
  if (!selection || typeof selection !== 'object') return { all: [] };
  const all = [];
  for (const [key, val] of Object.entries(selection)) {
    if (key.startsWith('filter')) continue;
    if (typeof val === 'string') {
      if (val.includes('|')) {
        const [field, pattern] = val.split('|');
        all.push({ field: mapSigmaField(field.trim()), op: 'regex', value: pattern.trim() });
      } else {
        all.push({ field: mapSigmaField(key), op: 'contains', value: val });
      }
    }
  }
  return { all };
}

function importSigmaYaml(yamlText, opts = {}) {
  const lines = yamlText.split('\n');
  const meta = {};
  let inLogsource = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('title:')) meta.name = t.slice(6).trim();
    if (t.startsWith('id:')) meta.sigma_id = t.slice(3).trim();
    if (t.startsWith('description:')) meta.description = t.slice(12).trim();
    if (t.startsWith('level:')) meta.severity = mapSigmaLevel(t.slice(6).trim());
    if (t.startsWith('tags:')) meta.tags = t.slice(5).trim();
    if (t === 'logsource:') inLogsource = true;
    if (inLogsource && t.startsWith('product:')) meta.platform = t.includes('windows') ? 'windows' : 'xdr';
  }

  const tactics = [];
  const techniques = [];
  if (meta.tags) {
    const tagList = meta.tags.replace(/[[\]]/g, '').split(',').map((s) => s.trim());
    for (const tag of tagList) {
      if (tag.startsWith('attack.t')) techniques.push(tag.replace('attack.', '').toUpperCase());
      if (tag.startsWith('attack.')) tactics.push(tag.replace('attack.', '').replace(/_/g, ' '));
    }
  }

  const slug = (meta.name || 'sigma-import')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  const id = opts.id || `IRN-WIN-EXE-${String(Date.now()).slice(-4)}`;

  return {
    id,
    name: meta.name || 'Imported Sigma Rule',
    description: meta.description || 'Imported from Sigma — requires manual review and tests.',
    status: 'draft',
    enabled: false,
    severity: meta.severity || 'medium',
    risk_score: 50,
    confidence: 40,
    platform: meta.platform || 'windows',
    data_sources: ['process_creation'],
    event_types: ['process_start'],
    category: 'execution',
    mitre: { tactics: tactics.length ? tactics : ['Execution'], techniques: techniques.length ? techniques : [] },
    logic: { all: [{ field: 'process.command_line', op: 'contains', value: 'review-me' }] },
    explain: {
      summary: 'Draft rule imported from Sigma — not enabled until reviewed.',
      matched_fields: [],
    },
    false_positives: ['Requires analyst tuning after import'],
    response_guidance: ['Review Sigma source', 'Add test fixtures', 'Tune logic', 'Submit for review'],
    author: 'Sigma Import',
    version: '0.1.0-draft',
    created_at: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString().slice(0, 10),
    tests: [],
    _sigma_import: true,
    _requires_review: true,
  };
}

function mapSigmaLevel(level) {
  const m = { informational: 'informational', low: 'low', medium: 'medium', high: 'high', critical: 'critical' };
  return m[level] || 'medium';
}

module.exports = { importSigmaYaml, mapSigmaField, SIGMA_FIELD_MAP };
