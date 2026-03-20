/**
 * Antivirus policy service - scan policies and exclusions
 */
const db = require('../../utils/db');

async function listPolicies(filters = {}) {
  let sql = 'SELECT * FROM av_scan_policies WHERE 1=1';
  const params = [];
  if (filters.tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(filters.tenantId);
  }
  sql += ' ORDER BY name ASC';
  return db.query(sql, params);
}

async function getById(id, tenantId = null) {
  let sql = 'SELECT * FROM av_scan_policies WHERE id = ?';
  const params = [id];
  if (tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(tenantId);
  }
  return db.queryOne(sql, params);
}

async function getForEndpoint(endpointId) {
  const ep = await db.queryOne(
    'SELECT e.tenant_id, a.policy_id FROM endpoints e LEFT JOIN endpoint_policy_assignments a ON a.endpoint_id = e.id WHERE e.id = ?',
    [endpointId]
  );
  if (!ep) return null;
  const policyId = ep.policy_id;
  if (policyId) {
    const p = await db.queryOne(
      'SELECT * FROM endpoint_policies WHERE id = ?',
      [policyId]
    );
    if (p) return mapPolicyToAv(p);
  }
  const avPolicy = await db.queryOne(
    'SELECT * FROM av_scan_policies WHERE (tenant_id = ? OR tenant_id IS NULL) ORDER BY tenant_id DESC LIMIT 1',
    [ep.tenant_id]
  );
  if (avPolicy) {
    return {
      id: avPolicy.id,
      name: avPolicy.name,
      realtime_enabled: !!avPolicy.realtime_enabled,
      scheduled_enabled: !!avPolicy.scheduled_enabled,
      execute_scan_enabled: !!avPolicy.execute_scan_enabled,
      quarantine_threshold: avPolicy.quarantine_threshold,
      alert_threshold: avPolicy.alert_threshold,
      max_file_size_mb: avPolicy.max_file_size_mb,
      process_kill_allowed: !!avPolicy.process_kill_allowed,
      rescan_on_detection: !!avPolicy.rescan_on_detection,
      include_paths: JSON.parse(avPolicy.include_paths_json || '[]'),
      exclude_paths: JSON.parse(avPolicy.exclude_paths_json || '[]'),
      exclude_extensions: JSON.parse(avPolicy.exclude_extensions_json || '[]'),
      exclude_hashes: JSON.parse(avPolicy.exclude_hashes_json || '[]'),
    };
  }
  return getDefaultPolicy(ep.tenant_id);
}

function mapPolicyToAv(policy) {
  const allowed = policy.allowed_triage_modules ? JSON.parse(policy.allowed_triage_modules || '[]') : [];
  return {
    id: policy.id,
    name: policy.name || 'Default',
    realtime_enabled: true,
    scheduled_enabled: true,
    execute_scan_enabled: true,
    quarantine_threshold: 70,
    alert_threshold: 50,
    max_file_size_mb: 100,
    process_kill_allowed: false,
    rescan_on_detection: true,
    include_paths: getDefaultIncludePaths(),
    exclude_paths: [],
    exclude_extensions: ['.log', '.tmp', '.cache'],
    exclude_hashes: [],
  };
}

function getDefaultPolicy(tenantId) {
  return {
    id: 0,
    name: 'Default',
    realtime_enabled: false,
    scheduled_enabled: true,
    execute_scan_enabled: true,
    quarantine_threshold: 70,
    alert_threshold: 50,
    max_file_size_mb: 100,
    process_kill_allowed: false,
    rescan_on_detection: true,
    include_paths: getDefaultIncludePaths(),
    exclude_paths: ['C:\\Windows\\WinSxS', 'C:\\Windows\\Temp\\*'],
    exclude_extensions: ['.log', '.tmp', '.cache', '.db'],
    exclude_hashes: [],
  };
}

function getDefaultIncludePaths() {
  return [
    'C:\\Users\\*\\AppData\\Local\\Temp',
    'C:\\Users\\*\\Downloads',
    'C:\\Users\\*\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup',
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup',
    'C:\\Windows\\Temp',
  ];
}

async function create(data, tenantId = null, createdBy = 'system') {
  const result = await db.execute(
    `INSERT INTO av_scan_policies (
      tenant_id, name, description, realtime_enabled, scheduled_enabled, execute_scan_enabled,
      quarantine_threshold, alert_threshold, max_file_size_mb, process_kill_allowed, rescan_on_detection,
      include_paths_json, exclude_paths_json, exclude_extensions_json, exclude_hashes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      data.name || 'New Policy',
      data.description || null,
      data.realtime_enabled ? 1 : 0,
      data.scheduled_enabled ? 1 : 0,
      data.execute_scan_enabled !== false ? 1 : 0,
      data.quarantine_threshold ?? 70,
      data.alert_threshold ?? 50,
      data.max_file_size_mb ?? 100,
      data.process_kill_allowed ? 1 : 0,
      data.rescan_on_detection !== false ? 1 : 0,
      JSON.stringify(data.include_paths || getDefaultIncludePaths()),
      JSON.stringify(data.exclude_paths || []),
      JSON.stringify(data.exclude_extensions || ['.log', '.tmp']),
      JSON.stringify(data.exclude_hashes || []),
    ]
  );
  return result.insertId;
}

async function update(id, data, tenantId = null) {
  const existing = await getById(id, tenantId);
  if (!existing) return null;

  await db.execute(
    `UPDATE av_scan_policies SET
      name = COALESCE(?, name), description = COALESCE(?, description),
      realtime_enabled = COALESCE(?, realtime_enabled), scheduled_enabled = COALESCE(?, scheduled_enabled),
      execute_scan_enabled = COALESCE(?, execute_scan_enabled),
      quarantine_threshold = COALESCE(?, quarantine_threshold), alert_threshold = COALESCE(?, alert_threshold),
      max_file_size_mb = COALESCE(?, max_file_size_mb), process_kill_allowed = COALESCE(?, process_kill_allowed),
      rescan_on_detection = COALESCE(?, rescan_on_detection),
      include_paths_json = COALESCE(?, include_paths_json), exclude_paths_json = COALESCE(?, exclude_paths_json),
      exclude_extensions_json = COALESCE(?, exclude_extensions_json), exclude_hashes_json = COALESCE(?, exclude_hashes_json)
    WHERE id = ?`,
    [
      data.name,
      data.description,
      data.realtime_enabled != null ? (data.realtime_enabled ? 1 : 0) : null,
      data.scheduled_enabled != null ? (data.scheduled_enabled ? 1 : 0) : null,
      data.execute_scan_enabled != null ? (data.execute_scan_enabled ? 1 : 0) : null,
      data.quarantine_threshold,
      data.alert_threshold,
      data.max_file_size_mb,
      data.process_kill_allowed != null ? (data.process_kill_allowed ? 1 : 0) : null,
      data.rescan_on_detection != null ? (data.rescan_on_detection ? 1 : 0) : null,
      data.include_paths ? JSON.stringify(data.include_paths) : null,
      data.exclude_paths ? JSON.stringify(data.exclude_paths) : null,
      data.exclude_extensions ? JSON.stringify(data.exclude_extensions) : null,
      data.exclude_hashes ? JSON.stringify(data.exclude_hashes) : null,
      id,
    ]
  );
  return id;
}

module.exports = {
  listPolicies,
  getById,
  getForEndpoint,
  getDefaultPolicy,
  create,
  update,
};
