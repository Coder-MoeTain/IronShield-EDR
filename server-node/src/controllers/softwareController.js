/**
 * Software Risk Management — admin API
 */
const SoftwareInventoryService = require('../modules/software/softwareInventoryService');
const SoftwareVulnerabilityService = require('../modules/software/softwareVulnerabilityService');
const SoftwareRemediationService = require('../modules/software/softwareRemediationService');
const SoftwareBlockPolicyService = require('../modules/software/softwareBlockPolicyService');
const AuditLogService = require('../services/AuditLogService');
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');

async function listInventory(req, res, next) {
  try {
    const { rows, total } = await SoftwareInventoryService.listInventory({
      ...req.query,
      tenantId: req.tenantId,
    });
    res.json({ inventory: rows, total });
  } catch (err) {
    next(err);
  }
}

async function getInventory(req, res, next) {
  try {
    const item = await SoftwareInventoryService.getById(req.params.id, req.tenantId);
    if (!item) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const summary = await SoftwareInventoryService.getSummary(req.tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function listVulnerabilities(req, res, next) {
  try {
    const result = await SoftwareVulnerabilityService.list(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createVulnerability(req, res, next) {
  try {
    const created = await SoftwareVulnerabilityService.create(req.body, req.user?.username);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function updateVulnerability(req, res, next) {
  try {
    await SoftwareVulnerabilityService.update(req.params.id, req.body, req.user?.username);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteVulnerability(req, res, next) {
  try {
    await SoftwareVulnerabilityService.remove(req.params.id, req.user?.username);
    res.json({ ok: true });
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
    res.json(action);
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
    res.json(action);
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
      req.body?.approved_by || req.user?.username
    );
    if (!result) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    res.json(result);
  } catch (err) {
    if (err.code === 'APPROVAL_REQUIRED') {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, err.message, 400);
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
    res.json(result || { ok: true });
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
    res.json(action);
  } catch (err) {
    next(err);
  }
}

async function refreshInventory(req, res, next) {
  try {
    const action = await SoftwareRemediationService.requestRefresh(
      req.params.id,
      req.tenantId,
      req.user?.username
    );
    if (!action) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404);
    res.json(action);
  } catch (err) {
    next(err);
  }
}

async function listRemediationActions(req, res, next) {
  try {
    const result = await SoftwareRemediationService.listActions(req.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listBlockPolicies(req, res, next) {
  try {
    const rows = await SoftwareBlockPolicyService.list(req.tenantId, req.query);
    res.json({ policies: rows });
  } catch (err) {
    next(err);
  }
}

async function createBlockPolicy(req, res, next) {
  try {
    const created = await SoftwareBlockPolicyService.create(req.tenantId, req.body, req.user?.username);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function updateBlockPolicy(req, res, next) {
  try {
    await SoftwareBlockPolicyService.update(req.params.id, req.tenantId, req.body, req.user?.username);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteBlockPolicy(req, res, next) {
  try {
    await SoftwareBlockPolicyService.remove(req.params.id, req.tenantId, req.user?.username);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    const { rows } = await SoftwareInventoryService.listInventory({
      tenantId: req.tenantId,
      ...req.query,
      limit: 5000,
    });
    const format = req.query.format || 'json';
    await AuditLogService.log({
      username: req.user?.username,
      action: 'software.report_exported',
      resourceType: 'report',
      details: { format, count: rows.length },
    });
    if (format === 'csv') {
      const header = 'name,vendor,version,hostname,risk_score,risk_level,status\n';
      const lines = rows.map(
        (r) =>
          `"${(r.name || '').replace(/"/g, '""')}","${r.vendor || ''}","${r.version || ''}","${r.hostname || ''}",${r.risk_score || 0},${r.risk_level || ''},${r.status}`
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=software-inventory.csv');
      return res.send(header + lines.join('\n'));
    }
    res.json({ exported_at: new Date().toISOString(), count: rows.length, rows });
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
  exportReport,
};
