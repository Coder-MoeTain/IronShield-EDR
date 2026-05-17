/**
 * Software execution block policies (tenant-scoped, audited, lifecycle-managed).
 */
const db = require('../../utils/db');
const AuditLogService = require('../../services/AuditLogService');
const { requiresBlockApproval } = require('./softwareRemediationService');
const {
  validateBlockPolicy,
  auditLifecycleTransition,
  isProtectedSoftwareName,
} = require('./softwareBlockSafety');

async function list(tenantId, filters = {}) {
  const { enabled, limit = 100, offset = 0, lifecycle_status: lifecycleStatus } = filters;
  const where = ['tenant_id = ?'];
  const params = [tenantId];
  if (enabled != null) {
    where.push('enabled = ?');
    params.push(enabled ? 1 : 0);
  }
  if (lifecycleStatus) {
    where.push('lifecycle_status = ?');
    params.push(lifecycleStatus);
  }
  const rows = await db.query(
    `SELECT * FROM software_block_policies WHERE ${where.join(' AND ')}
     ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return rows || [];
}

async function getById(id, tenantId) {
  const rows = await db.query(
    'SELECT * FROM software_block_policies WHERE id = ? AND tenant_id = ?',
    [id, tenantId]
  );
  return rows?.[0] || null;
}

async function transitionLifecycle(policyId, tenantId, toStatus, actor, extra = {}) {
  const policy = await getById(policyId, tenantId);
  if (!policy) return null;
  const fromStatus = policy.lifecycle_status || 'active';
  await db.query(
    'UPDATE software_block_policies SET lifecycle_status = ? WHERE id = ? AND tenant_id = ?',
    [toStatus, policyId, tenantId]
  );
  await auditLifecycleTransition({
    policyId,
    fromStatus,
    toStatus,
    actor,
    details: extra,
  });
  return { id: policyId, lifecycle_status: toStatus };
}

async function create(tenantId, data, actor, options = {}) {
  const isSuperAdmin = options.isSuperAdmin === true;
  const validation = validateBlockPolicy(data, { isSuperAdmin });
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.code = 'POLICY_VALIDATION';
    throw err;
  }

  const needsApproval = requiresBlockApproval(data) || options.forceApproval;
  const lifecycle = needsApproval ? 'pending_approval' : 'active';
  const enabled = needsApproval ? 0 : data.enabled !== false ? 1 : 0;

  const result = await db.execute(
    `INSERT INTO software_block_policies (
      tenant_id, name, description, software_name, vendor, version_expression,
      executable_path_pattern, file_hash, action, user_message_title, user_message_body,
      enabled, expires_at, created_by, requires_approval, lifecycle_status, block_reason, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      data.name,
      data.description || null,
      data.software_name,
      data.vendor || null,
      data.version_expression || null,
      data.executable_path_pattern || null,
      data.file_hash || null,
      data.action || 'block',
      data.user_message_title || 'Blocked by IT Security',
      data.user_message_body || data.message_body || 'This application is blocked by security policy.',
      enabled,
      data.expires_at || null,
      actor,
      needsApproval ? 1 : 0,
      lifecycle,
      data.block_reason || data.reason || null,
      data.requested_by || actor,
    ]
  );
  const id = result?.insertId;
  await AuditLogService.log({
    username: actor,
    action: 'software.block_policy_created',
    resourceType: 'software_block_policy',
    resourceId: String(id),
    details: { name: data.name, requires_approval: needsApproval, lifecycle_status: lifecycle },
  });
  return { id, requires_approval: needsApproval, lifecycle_status: lifecycle };
}

async function update(id, tenantId, data, actor, options = {}) {
  if (data.software_name || data.executable_path_pattern) {
    const existing = await getById(id, tenantId);
    const merged = { ...existing, ...data };
    const validation = validateBlockPolicy(merged, { isSuperAdmin: options.isSuperAdmin });
    if (!validation.valid) {
      const err = new Error(validation.errors.join('; '));
      err.code = 'POLICY_VALIDATION';
      throw err;
    }
  }
  await db.query(
    `UPDATE software_block_policies SET
      name = COALESCE(?, name), description = COALESCE(?, description),
      software_name = COALESCE(?, software_name), vendor = COALESCE(?, vendor),
      version_expression = COALESCE(?, version_expression),
      executable_path_pattern = COALESCE(?, executable_path_pattern),
      file_hash = COALESCE(?, file_hash), action = COALESCE(?, action),
      user_message_title = COALESCE(?, user_message_title),
      user_message_body = COALESCE(?, user_message_body),
      enabled = COALESCE(?, enabled), expires_at = COALESCE(?, expires_at),
      block_reason = COALESCE(?, block_reason)
     WHERE id = ? AND tenant_id = ?`,
    [
      data.name,
      data.description,
      data.software_name,
      data.vendor,
      data.version_expression,
      data.executable_path_pattern,
      data.file_hash,
      data.action,
      data.user_message_title,
      data.user_message_body,
      data.enabled != null ? (data.enabled ? 1 : 0) : null,
      data.expires_at,
      data.block_reason || data.reason,
      id,
      tenantId,
    ]
  );
  await AuditLogService.log({
    username: actor,
    action: 'software.block_policy_updated',
    resourceType: 'software_block_policy',
    resourceId: String(id),
  });
}

async function approve(id, tenantId, approver, requester) {
  if (approver === requester) {
    const err = new Error('Cannot approve own high-risk block request');
    err.code = 'SOD_VIOLATION';
    throw err;
  }
  const policy = await getById(id, tenantId);
  if (!policy) return null;
  if (policy.lifecycle_status !== 'pending_approval' && policy.requires_approval) {
    const err = new Error('Policy is not pending approval');
    err.code = 'INVALID_STATE';
    throw err;
  }
  await db.query(
    `UPDATE software_block_policies SET approved_by = ?, requires_approval = 0,
      enabled = 1, lifecycle_status = 'active' WHERE id = ? AND tenant_id = ?`,
    [approver, id, tenantId]
  );
  await transitionLifecycle(id, tenantId, 'active', approver, { approved_by: approver });
  await AuditLogService.log({
    username: approver,
    action: 'software.block_policy_approved',
    resourceType: 'software_block_policy',
    resourceId: String(id),
  });
  return { id, lifecycle_status: 'active', approved_by: approver };
}

async function remove(id, tenantId, actor) {
  await transitionLifecycle(id, tenantId, 'cancelled', actor);
  await db.query('DELETE FROM software_block_policies WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  await AuditLogService.log({
    username: actor,
    action: 'software.block_policy_deleted',
    resourceType: 'software_block_policy',
    resourceId: String(id),
  });
}

async function emergencyUnblockAll(tenantId, actor, reason) {
  await db.query(
    `UPDATE software_block_policies SET enabled = 0, lifecycle_status = 'rolled_back'
     WHERE tenant_id = ? AND enabled = 1`,
    [tenantId]
  );
  await db.query(
    `UPDATE endpoint_software_risk esr
     JOIN endpoint_software_inventory esi ON esi.id = esr.software_inventory_id
     SET esr.blocked = 0 WHERE esi.tenant_id = ?`,
    [tenantId]
  );
  await AuditLogService.log({
    username: actor,
    action: 'software.emergency_unblock',
    resourceType: 'tenant',
    resourceId: String(tenantId),
    details: { reason },
  });
  return { unblocked: true };
}

async function blockInventoryItem(inventoryId, tenantId, actor, body = {}) {
  const { reason, approved_by: approvedBy, expires_at: expiresAt } = body;
  if (!reason || String(reason).trim().length < 3) {
    const err = new Error('Block reason is required (min 3 characters)');
    err.code = 'REASON_REQUIRED';
    throw err;
  }

  const inv = await db.query(
    'SELECT * FROM endpoint_software_inventory WHERE id = ? AND tenant_id = ?',
    [inventoryId, tenantId]
  );
  const sw = inv?.[0];
  if (!sw) return null;

  if (isProtectedSoftwareName(sw.name)) {
    const err = new Error('Cannot block protected system or agent software');
    err.code = 'PROTECTED_SOFTWARE';
    throw err;
  }

  const policyData = {
    name: `Block ${sw.name}`,
    software_name: sw.name,
    vendor: sw.vendor,
    version_expression: sw.version ? `=${sw.version}` : null,
    action: 'block',
    block_reason: reason,
    expires_at: expiresAt || null,
  };
  const needsApproval = requiresBlockApproval(policyData);
  if (needsApproval) {
    if (!approvedBy) {
      const err = new Error('High-risk block requires separate approver (approved_by)');
      err.code = 'APPROVAL_REQUIRED';
      throw err;
    }
    if (approvedBy === actor) {
      const err = new Error('High-risk block cannot be self-approved');
      err.code = 'SOD_VIOLATION';
      throw err;
    }
  }

  const { id: policyId } = await create(tenantId, policyData, actor, { forceApproval: needsApproval });
  if (needsApproval && approvedBy) {
    await approve(policyId, tenantId, approvedBy, actor);
  } else if (!needsApproval) {
    await transitionLifecycle(policyId, tenantId, 'active', actor);
  }

  await db.query(
    'UPDATE endpoint_software_risk SET blocked = 1, recommended_action = ? WHERE software_inventory_id = ?',
    ['block', inventoryId]
  );

  const SoftwareRemediationService = require('./softwareRemediationService');
  await SoftwareRemediationService.createAction({
    tenantId,
    endpointId: sw.endpoint_id,
    softwareInventoryId: inventoryId,
    actionType: 'block_execution',
    messageTitle: 'Software blocked',
    messageBody: reason,
    requestedBy: actor,
    approvedBy: needsApproval ? approvedBy : null,
    requiresApproval: needsApproval,
    expiresAt,
  });

  return {
    policy_id: policyId,
    blocked: true,
    lifecycle_status: needsApproval ? 'active' : 'active',
    requires_approval: needsApproval,
  };
}

async function unblockInventoryItem(inventoryId, tenantId, actor) {
  await db.query(
    'UPDATE endpoint_software_risk SET blocked = 0 WHERE software_inventory_id = ?',
    [inventoryId]
  );
  const policies = await db.query(
    `SELECT id FROM software_block_policies sbp
     JOIN endpoint_software_inventory esi ON esi.name = sbp.software_name AND esi.tenant_id = sbp.tenant_id
     WHERE esi.id = ? AND sbp.tenant_id = ? AND sbp.enabled = 1`,
    [inventoryId, tenantId]
  );
  for (const p of policies || []) {
    await transitionLifecycle(p.id, tenantId, 'rolled_back', actor);
    await db.query('UPDATE software_block_policies SET enabled = 0 WHERE id = ?', [p.id]);
  }
  const SoftwareRemediationService = require('./softwareRemediationService');
  const inv = await db.query(
    'SELECT endpoint_id FROM endpoint_software_inventory WHERE id = ? AND tenant_id = ?',
    [inventoryId, tenantId]
  );
  if (inv?.[0]) {
    await SoftwareRemediationService.createAction({
      tenantId,
      endpointId: inv[0].endpoint_id,
      softwareInventoryId: inventoryId,
      actionType: 'unblock_execution',
      messageTitle: 'Software unblocked',
      messageBody: 'Block removed by admin',
      requestedBy: actor,
    });
  }
  await AuditLogService.log({
    username: actor,
    action: 'software.unblock',
    resourceType: 'software_inventory',
    resourceId: String(inventoryId),
  });
  return { blocked: false };
}

async function getAgentPolicies(tenantId) {
  const rows = await db.query(
    `SELECT id, name, software_name, vendor, version_expression, executable_path_pattern,
            file_hash, action, user_message_title, user_message_body, expires_at
     FROM software_block_policies
     WHERE tenant_id = ? AND enabled = 1
       AND lifecycle_status IN ('active', 'approved')
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (requires_approval = 0 OR approved_by IS NOT NULL)`,
    [tenantId]
  );
  const [ver] = await db.query(
    'SELECT COALESCE(MAX(updated_at), NOW()) AS v FROM software_block_policies WHERE tenant_id = ?',
    [tenantId]
  );
  const { PROTECTED_PROCESS_NAMES } = require('./softwareBlockSafety');
  return {
    policy_version: Date.parse(ver?.v || ver?.[0]?.v || Date.now()),
    inventory_enabled: true,
    inventory_interval_hours: 24,
    protected_processes: [...PROTECTED_PROCESS_NAMES],
    block_policies: (rows || []).map((r) => ({
      id: String(r.id),
      name: r.name,
      software_name: r.software_name,
      vendor: r.vendor,
      version_expression: r.version_expression,
      executable_path_pattern: r.executable_path_pattern,
      file_hash: r.file_hash,
      action: r.action,
      message_title: r.user_message_title,
      message_body: r.user_message_body,
      expires_at: r.expires_at,
    })),
  };
}

module.exports = {
  list,
  getById,
  create,
  update,
  approve,
  remove,
  transitionLifecycle,
  emergencyUnblockAll,
  blockInventoryItem,
  unblockInventoryItem,
  getAgentPolicies,
};
