/**
 * Software Risk Management — admin API (standard envelope)
 */
const SoftwareInventoryService = require('../modules/software/softwareInventoryService');
const SoftwareVulnerabilityService = require('../modules/software/softwareVulnerabilityService');
const SoftwareRemediationService = require('../modules/software/softwareRemediationService');
const SoftwareBlockPolicyService = require('../modules/software/softwareBlockPolicyService');
const SoftwareReportService = require('../modules/software/softwareReportService');
const IncidentService = require('../modules/incidents/incidentService');
const AuditLogService = require('../services/AuditLogService');
const { ERROR_CODES, sendSuccess, sendErrorFromReq, requestIdFromReq } = require('../utils/apiResponse');

function ok(res, req, data, status = 200, meta) {
  return sendSuccess(res, data, { status, meta, requestId: requestIdFromReq(req) });
}

async function listInventory(req, res, next) {
  try {
    const { rows, total } = await SoftwareInventoryService.listInventory({
      ...req.query,
      tenantId: req.tenantId,
    });
    ok(res, req, { inventory: rows, total }, 200, { total });
  } catch (err) {
    next(err);
  }
}

async function getInventory(req, res, next) {
  try {
    const item = await SoftwareInventoryService.getById(req.params.id, req.tenantId);
    if (!item) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    ok(res, req, item);
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const summary = await SoftwareInventoryService.getSummary(req.tenantId);
    ok(res, req, summary);
  } catch (err) {
    next(err);
  }
}

async function listVulnerabilities(req, res, next) {
  try {
    const result = await SoftwareVulnerabilityService.list(req.query);
    ok(res, req, result, 200, { total: result.total });
  } catch (err) {
    next(err);
  }
}

async function createVulnerability(req, res, next) {
  try {
    const created = await SoftwareVulnerabilityService.create(req.body, req.user?.username);
    ok(res, req, created, 201);
  } catch (err) {
    if (err.code === 'INVALID_CVE') {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
    }
    next(err);
  }
}

async function updateVulnerability(req, res, next) {
  try {
    await SoftwareVulnerabilityService.update(req.params.id, req.body, req.user?.username);
    ok(res, req, { updated: true });
  } catch (err) {
    next(err);
  }
}

async function deleteVulnerability(req, res, next) {
  try {
    await SoftwareVulnerabilityService.remove(req.params.id, req.user?.username);
    ok(res, req, { deleted: true });
  } catch (err) {
    next(err);
  }
}

async function notifyUpdate(req, res, next) {
  try {
    const action = await SoftwareRemediationService.notifyUpdate(
      req.params.id,
      req.tenantId,
      req.user?.username,
      req.body
    );
    if (!action) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    ok(res, req, action, 201);
  } catch (err) {
    next(err);
  }
}

async function notifyUninstall(req, res, next) {
  try {
    const action = await SoftwareRemediationService.notifyUninstall(
      req.params.id,
      req.tenantId,
      req.user?.username,
      req.body
    );
    if (!action) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    ok(res, req, action, 201);
  } catch (err) {
    next(err);
  }
}

async function blockInventory(req, res, next) {
  try {
    const result = await SoftwareBlockPolicyService.blockInventoryItem(
      req.params.id,
      req.tenantId,
      req.user?.username,
      req.body || {}
    );
    if (!result) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    ok(res, req, result, 201);
  } catch (err) {
    if (
      ['APPROVAL_REQUIRED', 'SOD_VIOLATION', 'REASON_REQUIRED', 'PROTECTED_SOFTWARE', 'POLICY_VALIDATION'].includes(
        err.code
      )
    ) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400, { code: err.code });
    }
    next(err);
  }
}

async function unblockInventory(req, res, next) {
  try {
    const result = await SoftwareBlockPolicyService.unblockInventoryItem(
      req.params.id,
      req.tenantId,
      req.user?.username
    );
    ok(res, req, result || { blocked: false });
  } catch (err) {
    next(err);
  }
}

async function acceptRisk(req, res, next) {
  try {
    const action = await SoftwareRemediationService.acceptRisk(
      req.params.id,
      req.tenantId,
      req.user?.username,
      req.body
    );
    if (!action) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    ok(res, req, action);
  } catch (err) {
    if (err.code === 'REASON_REQUIRED') {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
    }
    next(err);
  }
}

async function refreshInventory(req, res, next) {
  try {
    const sw = await SoftwareInventoryService.getById(req.params.id, req.tenantId);
    if (!sw) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    const pending = await SoftwareRemediationService.hasPendingRefresh(sw.endpoint_id, req.tenantId);
    if (pending) {
      return sendErrorFromReq(
        res,
        req,
        ERROR_CODES.VALIDATION_ERROR,
        'Inventory refresh already pending for this endpoint',
        409,
        { code: 'REFRESH_PENDING' }
      );
    }
    const action = await SoftwareRemediationService.requestRefresh(
      req.params.id,
      req.tenantId,
      req.user?.username
    );
    if (!action) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    ok(res, req, action, 201);
  } catch (err) {
    next(err);
  }
}

async function listRemediationActions(req, res, next) {
  try {
    const result = await SoftwareRemediationService.listActions(req.tenantId, req.query);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

async function listBlockPolicies(req, res, next) {
  try {
    const rows = await SoftwareBlockPolicyService.list(req.tenantId, req.query);
    ok(res, req, { policies: rows });
  } catch (err) {
    next(err);
  }
}

async function createBlockPolicy(req, res, next) {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const created = await SoftwareBlockPolicyService.create(req.tenantId, req.body, req.user?.username, {
      isSuperAdmin,
    });
    ok(res, req, created, 201);
  } catch (err) {
    if (err.code === 'POLICY_VALIDATION') {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
    }
    next(err);
  }
}

async function updateBlockPolicy(req, res, next) {
  try {
    await SoftwareBlockPolicyService.update(req.params.id, req.tenantId, req.body, req.user?.username, {
      isSuperAdmin: req.user?.role === 'super_admin',
    });
    ok(res, req, { updated: true });
  } catch (err) {
    if (err.code === 'POLICY_VALIDATION') {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
    }
    next(err);
  }
}

async function deleteBlockPolicy(req, res, next) {
  try {
    await SoftwareBlockPolicyService.remove(req.params.id, req.tenantId, req.user?.username);
    ok(res, req, { deleted: true });
  } catch (err) {
    next(err);
  }
}

async function approveBlockPolicy(req, res, next) {
  try {
    const policy = await SoftwareBlockPolicyService.getById(req.params.id, req.tenantId);
    if (!policy) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    const result = await SoftwareBlockPolicyService.approve(
      req.params.id,
      req.tenantId,
      req.user?.username,
      policy.requested_by || policy.created_by
    );
    ok(res, req, result);
  } catch (err) {
    if (['SOD_VIOLATION', 'INVALID_STATE'].includes(err.code)) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
    }
    next(err);
  }
}

async function emergencyUnblock(req, res, next) {
  try {
    const { reason } = req.body || {};
    if (!reason || String(reason).trim().length < 5) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'Emergency unblock reason required', 400);
    }
    const result = await SoftwareBlockPolicyService.emergencyUnblockAll(req.tenantId, req.user?.username, reason);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    const reportType = req.params.type || req.query.report || 'endpoint-inventory';
    const format = (req.query.format || 'json').toLowerCase();

    if (!SoftwareReportService.REPORT_TYPES.includes(reportType)) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'Invalid report type', 400);
    }

    const report = await SoftwareReportService.generateReport(req.tenantId, reportType, req.query);
    await AuditLogService.log({
      username: req.user?.username,
      action: 'software.report_exported',
      resourceType: 'report',
      details: { format, report_type: reportType, count: report.row_count },
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=software-${reportType}.csv`);
      return res.send(SoftwareReportService.toCsv(report));
    }
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(SoftwareReportService.toHtml(report));
    }
    ok(res, req, report);
  } catch (err) {
    next(err);
  }
}

async function importVulnerabilities(req, res, next) {
  try {
    const records = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.records)
        ? req.body.records
        : null;
    if (!records?.length) {
      return sendErrorFromReq(
        res,
        req,
        ERROR_CODES.VALIDATION_ERROR,
        'Request body must be a JSON array or { records: [...] }',
        400
      );
    }
    const result = await SoftwareVulnerabilityService.importBatch(records, req.user?.username);
    await AuditLogService.log({
      username: req.user?.username,
      action: 'software.vulnerability_import',
      resourceType: 'software_vulnerability',
      details: result,
    });
    ok(res, req, result, 201);
  } catch (err) {
    next(err);
  }
}

async function createSoftwareIncident(req, res, next) {
  try {
    const sw = await SoftwareInventoryService.getById(req.params.id, req.tenantId);
    if (!sw) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    const incident = await IncidentService.create({
      title: req.body?.title || `Software risk: ${sw.name}`,
      description:
        req.body?.description ||
        `Software ${sw.name} ${sw.version || ''} on endpoint ${sw.hostname || sw.endpoint_id}. Risk score ${sw.risk_score}/100. ${sw.reason || ''}`,
      severity: sw.risk_level === 'critical' ? 'critical' : sw.risk_level === 'high' ? 'high' : 'medium',
      endpoint_id: sw.endpoint_id,
      tenant_id: req.tenantId,
      correlation_type: 'software_risk',
      lifecycle_phase: 'triage',
      created_by: req.user?.username,
    });
    const link = await IncidentService.linkSoftwareInventory(
      incident.id,
      req.params.id,
      req.user?.username,
      { risk_score: sw.risk_score, risk_level: sw.risk_level }
    );
    ok(res, req, { ...incident, software_link: link }, 201);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInventory,
  getInventory,
  getSummary,
  listVulnerabilities,
  createVulnerability,
  updateVulnerability,
  deleteVulnerability,
  notifyUpdate,
  notifyUninstall,
  blockInventory,
  unblockInventory,
  acceptRisk,
  refreshInventory,
  listRemediationActions,
  listBlockPolicies,
  createBlockPolicy,
  updateBlockPolicy,
  deleteBlockPolicy,
  approveBlockPolicy,
  emergencyUnblock,
  exportReport,
  importVulnerabilities,
  createSoftwareIncident,
};
