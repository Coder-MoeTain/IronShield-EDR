/**
 * Antivirus scan service - tasks and results
 */
const db = require('../../utils/db');
const MalwareAlertService = require('./malwareAlertService');

async function listTasks(filters = {}) {
  let sql = `
    SELECT t.*, e.hostname
    FROM av_scan_tasks t
    JOIN endpoints e ON e.id = t.endpoint_id
    WHERE 1=1
  `;
  const params = [];
  if (filters.endpointId) {
    sql += ' AND t.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.status) {
    sql += ' AND t.status = ?';
    params.push(filters.status);
  }
  sql += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(Math.min(parseInt(filters.limit) || 50, 200));
  return db.query(sql, params);
}

async function getTask(id) {
  return db.queryOne(
    `SELECT t.*, e.hostname FROM av_scan_tasks t
     JOIN endpoints e ON e.id = t.endpoint_id WHERE t.id = ?`,
    [id]
  );
}

async function getPendingForEndpoint(endpointId) {
  return db.query(
    'SELECT * FROM av_scan_tasks WHERE endpoint_id = ? AND status = ? ORDER BY created_at ASC',
    [endpointId, 'pending']
  );
}

async function createTask(endpointId, taskType, requestedBy, targetPath = null, policyId = null) {
  const result = await db.execute(
    `INSERT INTO av_scan_tasks (endpoint_id, task_type, requested_by, target_path, policy_id, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [endpointId, taskType, requestedBy || 'system', targetPath, policyId]
  );
  return result.insertId;
}

async function markInProgress(id) {
  await db.execute(
    "UPDATE av_scan_tasks SET status = 'in_progress', updated_at = NOW() WHERE id = ?",
    [id]
  );
}

async function completeTask(id, filesScanned, detectionsFound, errorMessage = null) {
  await db.execute(
    `UPDATE av_scan_tasks SET status = ?, completed_at = NOW(), files_scanned = ?, detections_found = ?, error_message = ?, updated_at = NOW()
     WHERE id = ?`,
    [errorMessage ? 'failed' : 'completed', filesScanned || 0, detectionsFound || 0, errorMessage, id]
  );
}

async function saveScanResult(endpointId, data, taskId = null) {
  const result = await db.execute(
    `INSERT INTO av_scan_results (endpoint_id, task_id, file_path, file_name, sha256, file_size, detection_name, detection_type, family, severity, score, disposition, signer_status, raw_details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      endpointId,
      taskId,
      data.file_path || '',
      data.file_name || null,
      data.sha256 || null,
      data.file_size ?? null,
      data.detection_name || null,
      data.detection_type || 'heuristic',
      data.family || null,
      data.severity || 'medium',
      data.score ?? 0,
      data.disposition || 'suspicious',
      data.signer_status || null,
      JSON.stringify(data.raw_details || {}),
    ]
  );
  const resultId = result.insertId;

  const det = String(data.detection_type || '').toLowerCase();
  const shouldAlert =
    (data.severity && ['high', 'critical'].includes(data.severity)) || det === 'ransomware';
  if (shouldAlert) {
    await MalwareAlertService.createFromScanResult(resultId, endpointId, data);
  }

  return resultId;
}

async function listResults(filters = {}) {
  let sql = `
    SELECT r.*, e.hostname
    FROM av_scan_results r
    JOIN endpoints e ON e.id = r.endpoint_id
    WHERE 1=1
  `;
  const params = [];
  if (filters.endpointId) {
    sql += ' AND r.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.severity) {
    sql += ' AND r.severity = ?';
    params.push(filters.severity);
  }
  if (filters.sha256) {
    sql += ' AND r.sha256 = ?';
    params.push(filters.sha256);
  }
  if (filters.dateFrom) {
    sql += ' AND r.scan_time >= ?';
    params.push(filters.dateFrom);
  }
  sql += ' ORDER BY r.scan_time DESC LIMIT ?';
  params.push(Math.min(parseInt(filters.limit) || 100, 500));
  return db.query(sql, params);
}

async function getResult(id) {
  return db.queryOne(
    `SELECT r.*, e.hostname FROM av_scan_results r
     JOIN endpoints e ON e.id = r.endpoint_id WHERE r.id = ?`,
    [id]
  );
}

async function getDashboardSummary(tenantId = null) {
  const today = new Date().toISOString().slice(0, 10);
  const [detectionsToday] = await db.query(
    'SELECT COUNT(*) as c FROM av_scan_results WHERE DATE(scan_time) = ? AND severity IN ("high","critical")',
    [today]
  );
  const [quarantined] = await db.query(
    'SELECT COUNT(*) as c FROM av_quarantine_items WHERE status = ?',
    ['quarantined']
  );
  const [totalDetections] = await db.query(
    'SELECT COUNT(*) as c FROM av_scan_results WHERE disposition IN ("malicious","quarantined","suspicious")'
  );
  const [pendingTasks] = await db.query(
    "SELECT COUNT(*) as c FROM av_scan_tasks WHERE status = 'pending'"
  );
  const [infectedEndpoints] = await db.query(
    `SELECT COUNT(DISTINCT endpoint_id) as c FROM av_scan_results 
     WHERE disposition IN ("malicious","quarantined") AND scan_time > DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );
  const [pendingReview] = await db.query(
    `SELECT COUNT(*) as c FROM malware_alerts WHERE status = 'new'`
  );

  return {
    detections_today: Number(detectionsToday?.[0]?.c ?? 0),
    quarantined_count: Number(quarantined?.[0]?.c ?? 0),
    total_detections: Number(totalDetections?.[0]?.c ?? 0),
    pending_tasks: Number(pendingTasks?.[0]?.c ?? 0),
    infected_endpoints: Number(infectedEndpoints?.[0]?.c ?? 0),
    pending_review: Number(pendingReview?.[0]?.c ?? 0),
  };
}

module.exports = {
  listTasks,
  getTask,
  getPendingForEndpoint,
  createTask,
  markInProgress,
  completeTask,
  saveScanResult,
  listResults,
  getResult,
  getDashboardSummary,
};
