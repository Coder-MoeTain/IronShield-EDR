/**
 * Software Risk Management — agent API (standard envelope)
 */
const SoftwareInventoryService = require('../modules/software/softwareInventoryService');
const SoftwareBlockPolicyService = require('../modules/software/softwareBlockPolicyService');
const SoftwareRemediationService = require('../modules/software/softwareRemediationService');
const AuditLogService = require('../services/AuditLogService');
const { ERROR_CODES, sendSuccess, sendErrorFromReq, requestIdFromReq } = require('../utils/apiResponse');

function ok(res, req, data, status = 200) {
  return sendSuccess(res, data, { status, requestId: requestIdFromReq(req) });
}

async function uploadInventory(req, res, next) {
  try {
    const body = req.body || {};
    const endpointId = req.endpointId || body.endpoint_id;
    const tenantId = req.tenantId;
    if (!endpointId || !tenantId) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'endpoint required', 400);
    }
    const summary = await SoftwareInventoryService.ingestInventory({
      tenantId,
      endpointId,
      scanType: body.scan_type || 'delta',
      inventoryScanId: body.inventory_scan_id,
      startedAt: body.started_at,
      completedAt: body.completed_at,
      software: body.software,
      removedFingerprints: body.removed_fingerprints,
      agentVersion: body.agent_version,
    });
    await SoftwareInventoryService.logInventoryUpload({
      tenantId,
      endpointId,
      summary,
      username: `agent:${endpointId}`,
    });
    ok(res, req, summary);
  } catch (err) {
    next(err);
  }
}

async function getSoftwarePolicies(req, res, next) {
  try {
    const tenantId = req.tenantId;
    const policies = await SoftwareBlockPolicyService.getAgentPolicies(tenantId);
    const notifications = await SoftwareRemediationService.getPendingNotifications(
      req.endpointId,
      tenantId
    );
    const pendingRefresh = await SoftwareRemediationService.hasPendingRefresh(req.endpointId, tenantId);
    ok(res, req, {
      ...policies,
      pending_notifications: notifications || [],
      pending_refresh: pendingRefresh,
    });
  } catch (err) {
    next(err);
  }
}

async function submitPolicyResult(req, res, next) {
  try {
    const { policy_id, event_type, process_name, process_path, action_taken } = req.body || {};
    await AuditLogService.log({
      username: `agent:${req.endpointId}`,
      action: `software.${event_type || 'execution_event'}`,
      resourceType: 'software_block_policy',
      resourceId: String(policy_id || ''),
      details: { process_name, process_path, action_taken },
    });
    ok(res, req, { recorded: true });
  } catch (err) {
    next(err);
  }
}

async function submitNotificationResult(req, res, next) {
  try {
    const body = req.body || {};
    const result = await SoftwareRemediationService.recordNotificationResult({
      tenantId: req.tenantId,
      endpointId: req.endpointId,
      notificationId: body.notification_id,
      userResponse: body.user_response,
      status: body.status,
    });
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadInventory,
  getSoftwarePolicies,
  submitPolicyResult,
  submitNotificationResult,
};
