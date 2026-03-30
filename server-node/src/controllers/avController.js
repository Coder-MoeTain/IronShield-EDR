/**
 * Antivirus controller - agent and admin APIs
 */
const EndpointService = require('../services/EndpointService');
const AvPolicyService = require('../modules/antivirus/avPolicyService');
const AvSignatureService = require('../modules/antivirus/avSignatureService');
const AvScanService = require('../modules/antivirus/avScanService');
const AvQuarantineService = require('../modules/antivirus/avQuarantineService');
const MalwareAlertService = require('../modules/antivirus/malwareAlertService');
const AvExclusionsService = require('../modules/antivirus/avExclusionsService');
const FileReputationService = require('../modules/antivirus/fileReputationService');
const AuditLogService = require('../services/AuditLogService');
const db = require('../utils/db');
const logger = require('../utils/logger');

// ============ AGENT APIs ============

async function getAgentPolicy(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const policy = await AvPolicyService.getForEndpoint(endpoint.id);
    res.json(policy || AvPolicyService.getDefaultPolicy());
  } catch (err) {
    next(err);
  }
}

async function getSignaturesVersion(req, res, next) {
  try {
    const bundle = await AvSignatureService.getActiveBundle();
    res.json({ version: bundle?.bundle_version || 'v0', updated_at: bundle?.created_at });
  } catch (err) {
    next(err);
  }
}

async function downloadSignatures(req, res, next) {
  try {
    const version = req.query.version || 'latest';
    const bundle = await AvSignatureService.getActiveBundle();
    const v = version === 'latest' ? bundle?.bundle_version : version;
    const signatures = await AvSignatureService.getSignaturesForBundle(v || 'v0');
    res.json({ version: v || 'v0', signatures });
  } catch (err) {
    next(err);
  }
}

async function submitScanResult(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const body = req.body || {};
    const results = Array.isArray(body.results) ? body.results : (body.result ? [body.result] : []);
    const taskId = body.task_id || null;
    for (const r of results.slice(0, 500)) {
      try {
        await AvScanService.saveScanResult(endpoint.id, r, taskId);
      } catch (e) {
        logger.warn({ err: e.message }, 'AV scan result save error');
      }
    }
    res.json({ ok: true, saved: results.length });
  } catch (err) {
    next(err);
  }
}

async function submitQuarantineResult(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const body = req.body || {};
    await AvQuarantineService.create(endpoint.id, {
      original_path: body.original_path,
      quarantine_path: body.quarantine_path,
      sha256: body.sha256,
      detection_name: body.detection_name,
      quarantined_by: body.quarantined_by || 'agent',
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function submitUpdateStatus(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const { bundle_version, status, error_message } = req.body || {};
    const lastApplied = status === 'up_to_date' ? new Date() : null;
    await db.execute(
      `INSERT INTO av_update_status (endpoint_id, bundle_version, status, last_checked_at, last_applied_at, error_message)
       VALUES (?, ?, ?, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE bundle_version = VALUES(bundle_version), status = VALUES(status),
         last_checked_at = NOW(), last_applied_at = COALESCE(VALUES(last_applied_at), last_applied_at),
         error_message = VALUES(error_message), updated_at = NOW()`,
      [endpoint.id, bundle_version || null, status || 'unknown', lastApplied, error_message || null]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getPendingTasks(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const tasks = await AvScanService.getPendingForEndpoint(endpoint.id);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

async function submitTaskResult(req, res, next) {
  try {
    const { id } = req.params;
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });
    const task = await AvScanService.getTask(id);
    if (!task || task.endpoint_id !== endpoint.id) return res.status(404).json({ error: 'Task not found' });
    const body = req.body || {};
    await AvScanService.completeTask(id, body.files_scanned, body.detections_found, body.error_message);
    if (body.results && Array.isArray(body.results)) {
      for (const r of body.results.slice(0, 200)) {
        try {
          await AvScanService.saveScanResult(endpoint.id, r, task.id);
        } catch (e) {
          logger.warn({ err: e.message }, 'AV scan result save error');
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ============ ADMIN APIs ============

async function getDashboardSummary(req, res, next) {
  try {
    const summary = await AvScanService.getDashboardSummary(req.tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function listDetections(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await AvScanService.listResults(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getDetection(req, res, next) {
  try {
    const row = await AvScanService.getResult(req.params.id);
    if (!row) return res.status(404).json({ error: 'Detection not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function listQuarantine(req, res, next) {
  try {
    const filters = { ...req.query };
    const rows = await AvQuarantineService.list(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function restoreQuarantine(req, res, next) {
  try {
    const id = req.params.id;
    const user = req.user?.username || 'unknown';
    const item = await AvQuarantineService.getById(id);
    if (!item) return res.status(404).json({ error: 'Quarantine item not found' });
    await AvQuarantineService.markRestored(id, user);
    await AuditLogService.log({
      userId: req.user?.id,
      username: user,
      action: 'av_quarantine_restore',
      resourceType: 'av_quarantine_item',
      resourceId: String(id),
      details: { original_path: item.original_path, sha256: item.sha256, detection_name: item.detection_name },
    });
    res.json({ ok: true, message: 'Restore requested - agent will process on next poll' });
  } catch (err) {
    next(err);
  }
}

async function deleteQuarantine(req, res, next) {
  try {
    const id = req.params.id;
    const user = req.user?.username || 'unknown';
    const item = await AvQuarantineService.getById(id);
    if (!item) return res.status(404).json({ error: 'Quarantine item not found' });
    await AvQuarantineService.markDeleted(id, user);
    await AuditLogService.log({
      userId: req.user?.id,
      username: user,
      action: 'av_quarantine_delete',
      resourceType: 'av_quarantine_item',
      resourceId: String(id),
      details: { original_path: item.original_path, sha256: item.sha256, detection_name: item.detection_name },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listPolicies(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await AvPolicyService.listPolicies(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getPolicy(req, res, next) {
  try {
    const row = await AvPolicyService.getPolicy(req.params.id, req.tenantId);
    if (!row) return res.status(404).json({ error: 'Policy not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function createPolicy(req, res, next) {
  try {
    const id = await AvPolicyService.create(req.body || {}, req.tenantId, req.user?.username);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function updatePolicy(req, res, next) {
  try {
    await AvPolicyService.update(req.params.id, req.body || {}, req.tenantId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listSignatures(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await AvSignatureService.listSignatures(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createSignature(req, res, next) {
  try {
    const uuid = await AvSignatureService.createSignature(req.body || {}, req.tenantId);
    res.status(201).json({ signature_uuid: uuid });
  } catch (err) {
    next(err);
  }
}

async function updateSignature(req, res, next) {
  try {
    const row = await AvSignatureService.updateSignature(req.params.id, req.body || {}, req.tenantId);
    if (!row) return res.status(404).json({ error: 'Signature not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function listExclusions(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const rows = await AvExclusionsService.list(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createExclusion(req, res, next) {
  try {
    const id = await AvExclusionsService.create(req.body || {}, req.tenantId, req.user?.username);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function deleteExclusion(req, res, next) {
  try {
    await AvExclusionsService.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getFileReputation(req, res, next) {
  try {
    const sha256 = req.query.sha256;
    if (!sha256) return res.status(400).json({ error: 'sha256 query parameter required' });
    const rep = await FileReputationService.getReputation(sha256, req.tenantId);
    res.json(rep);
  } catch (err) {
    next(err);
  }
}

async function createScanTask(req, res, next) {
  try {
    const { endpointId } = req.body || {};
    if (!endpointId) return res.status(400).json({ error: 'endpointId required' });
    const id = await AvScanService.createTask(
      endpointId,
      req.body.task_type || 'on_demand',
      req.user?.username,
      req.body.target_path,
      req.body.policy_id
    );
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function listScanTasks(req, res, next) {
  try {
    const filters = { ...req.query };
    const rows = await AvScanService.listTasks(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function listMalwareAlerts(req, res, next) {
  try {
    const filters = { ...req.query };
    const rows = await MalwareAlertService.list(filters);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getMalwareAlert(req, res, next) {
  try {
    const row = await MalwareAlertService.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Alert not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function updateMalwareAlertStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!['new', 'investigating', 'resolved', 'false_positive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const row = await MalwareAlertService.updateStatus(req.params.id, status, req.user?.username);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function listUpdateStatus(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT s.*, e.hostname FROM av_update_status s
       JOIN endpoints e ON e.id = s.endpoint_id
       ORDER BY s.updated_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAgentPolicy,
  getSignaturesVersion,
  downloadSignatures,
  submitScanResult,
  submitQuarantineResult,
  submitUpdateStatus,
  getPendingTasks,
  submitTaskResult,
  getDashboardSummary,
  listDetections,
  getDetection,
  listQuarantine,
  restoreQuarantine,
  deleteQuarantine,
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  listSignatures,
  createSignature,
  updateSignature,
  listExclusions,
  createExclusion,
  deleteExclusion,
  getFileReputation,
  createScanTask,
  listScanTasks,
  listMalwareAlerts,
  getMalwareAlert,
  updateMalwareAlertStatus,
  listUpdateStatus,
};
