const config = require('../config');

const DANGEROUS_ACTIONS = new Set([
  'isolate_host',
  'lift_isolation',
  'quarantine_file',
  'block_ip',
  'run_script',
  'delete_schtask',
  'delete_run_key',
  'delete_path',
]);

function normalizeActionType(actionType) {
  const raw = String(actionType || '').toLowerCase();
  return raw === 'simulate_isolation' ? 'isolate_host' : raw;
}

function requiresApproval(actionType) {
  return DANGEROUS_ACTIONS.has(normalizeActionType(actionType));
}

function canDecideByRole(role) {
  return ['admin', 'analyst', 'super_admin'].includes(String(role || '').toLowerCase());
}

function evaluateCreation({ actionType, justification }) {
  const normalizedType = normalizeActionType(actionType);
  if (!normalizedType) {
    throw new Error('action_type is required');
  }

  const enforce = config.responseApprovals?.requireJustificationForHighRisk !== false;
  const minLen = Math.max(1, Number(config.responseApprovals?.minJustificationLength || 8));
  if (enforce && requiresApproval(normalizedType) && String(justification || '').trim().length < minLen) {
    throw new Error('justification is required for high-risk response actions');
  }

  return {
    actionType: normalizedType,
    approvalStatus: requiresApproval(normalizedType) ? 'pending' : 'auto',
    policyVersion: 'phase2-v1',
  };
}

function evaluateDecision({ action, actor, requireTwoPerson = true, reason = null }) {
  if (!action) throw new Error('Action not found');
  if (action.approval_status !== 'pending') throw new Error('Action is not pending approval');
  if (!canDecideByRole(actor?.role)) throw new Error('Approval policy denied for this role');
  if (requireTwoPerson && String(action.requested_by || '').toLowerCase() === String(actor?.username || '').toLowerCase()) {
    throw new Error('Two-person rule: requester cannot approve own action');
  }

  if (reason != null && String(reason).trim().length > 512) {
    throw new Error('Decision reason too long');
  }

  return {
    policyVersion: 'phase2-v1',
  };
}

module.exports = {
  normalizeActionType,
  requiresApproval,
  canDecideByRole,
  evaluateCreation,
  evaluateDecision,
};
