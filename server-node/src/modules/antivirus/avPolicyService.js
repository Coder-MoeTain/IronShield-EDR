/**
 * Antivirus policy service - scan policies and exclusions
 */
const db = require('../../utils/db');

function normalizeRemovableAction(v) {
  const a = String(v || 'audit')
    .trim()
    .toLowerCase();
  if (a === 'block' || a === 'allow' || a === 'audit') return a;
  return 'audit';
}

function toApiPolicy(row) {
  if (!row) return null;
  const rawRt = row.realtime_debounce_seconds != null ? Number(row.realtime_debounce_seconds) : 2;
  const debounce = Math.min(60, Math.max(1, Number.isFinite(rawRt) ? rawRt : 2));
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    description: row.description,
    realtime_enabled: !!row.realtime_enabled,
    scheduled_enabled: !!row.scheduled_enabled,
    execute_scan_enabled: !!row.execute_scan_enabled,
    quarantine_threshold: row.quarantine_threshold,
    alert_threshold: row.alert_threshold,
    max_file_size_mb: row.max_file_size_mb,
    process_kill_allowed: !!row.process_kill_allowed,
    rescan_on_detection: !!row.rescan_on_detection,
    realtime_debounce_seconds: debounce,
    device_control_enabled: !!row.device_control_enabled,
    web_url_protection_enabled:
      row.web_url_protection_enabled === null || row.web_url_protection_enabled === undefined
        ? true
        : !!row.web_url_protection_enabled,
    removable_storage_action: normalizeRemovableAction(row.removable_storage_action),
    ransomware_protection_enabled:
      row.ransomware_protection_enabled === null || row.ransomware_protection_enabled === undefined
        ? true
        : !!row.ransomware_protection_enabled,
    include_paths: JSON.parse(row.include_paths_json || '[]'),
    exclude_paths: JSON.parse(row.exclude_paths_json || '[]'),
    exclude_extensions: JSON.parse(row.exclude_extensions_json || '[]'),
    exclude_hashes: JSON.parse(row.exclude_hashes_json || '[]'),
  };
}

async function listPolicies(filters = {}) {
  let sql = 'SELECT * FROM av_scan_policies WHERE 1=1';
  const params = [];
  if (filters.tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(filters.tenantId);
  }
  sql += ' ORDER BY name ASC';
  const rows = await db.query(sql, params);
  return rows.map(toApiPolicy);
}

async function getPolicy(id, tenantId = null) {
  const row = await getById(id, tenantId);
  return toApiPolicy(row);
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
      realtime_debounce_seconds: (() => {
        const raw =
          avPolicy.realtime_debounce_seconds != null ? Number(avPolicy.realtime_debounce_seconds) : 2;
        const v = Number.isFinite(raw) ? raw : 2;
        return Math.min(60, Math.max(1, v));
      })(),
      device_control_enabled: !!avPolicy.device_control_enabled,
      web_url_protection_enabled:
        avPolicy.web_url_protection_enabled != null ? !!avPolicy.web_url_protection_enabled : true,
      removable_storage_action: normalizeRemovableAction(avPolicy.removable_storage_action),
      ransomware_protection_enabled:
        avPolicy.ransomware_protection_enabled === null || avPolicy.ransomware_protection_enabled === undefined
          ? true
          : !!avPolicy.ransomware_protection_enabled,
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
    realtime_debounce_seconds: 2,
    device_control_enabled: false,
    web_url_protection_enabled: true,
    removable_storage_action: 'audit',
    ransomware_protection_enabled: true,
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
    realtime_debounce_seconds: 2,
    device_control_enabled: false,
    web_url_protection_enabled: true,
    removable_storage_action: 'audit',
    ransomware_protection_enabled: true,
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
      realtime_debounce_seconds,
      device_control_enabled, web_url_protection_enabled, removable_storage_action, ransomware_protection_enabled,
      include_paths_json, exclude_paths_json, exclude_extensions_json, exclude_hashes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      Math.min(60, Math.max(1, parseInt(data.realtime_debounce_seconds, 10) || 2)),
      data.device_control_enabled ? 1 : 0,
      data.web_url_protection_enabled != null ? (data.web_url_protection_enabled ? 1 : 0) : 1,
      normalizeRemovableAction(data.removable_storage_action),
      data.ransomware_protection_enabled !== false ? 1 : 0,
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
      realtime_debounce_seconds = COALESCE(?, realtime_debounce_seconds),
      device_control_enabled = COALESCE(?, device_control_enabled),
      web_url_protection_enabled = COALESCE(?, web_url_protection_enabled),
      removable_storage_action = COALESCE(?, removable_storage_action),
      ransomware_protection_enabled = COALESCE(?, ransomware_protection_enabled),
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
      data.realtime_debounce_seconds != null
        ? Math.min(60, Math.max(1, parseInt(data.realtime_debounce_seconds, 10) || 2))
        : null,
      data.device_control_enabled != null ? (data.device_control_enabled ? 1 : 0) : null,
      data.web_url_protection_enabled != null ? (data.web_url_protection_enabled ? 1 : 0) : null,
      data.removable_storage_action != null ? normalizeRemovableAction(data.removable_storage_action) : null,
      data.ransomware_protection_enabled != null ? (data.ransomware_protection_enabled ? 1 : 0) : null,
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
  getPolicy,
  getForEndpoint,
  getDefaultPolicy,
  create,
  update,
};
