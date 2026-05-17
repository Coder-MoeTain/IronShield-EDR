/**
 * Block policy safety: protected processes, wildcard validation, policy checks.
 */
const AuditLogService = require('../../services/AuditLogService');

const PROTECTED_PROCESS_NAMES = new Set([
  'system',
  'idle',
  'wininit',
  'services',
  'lsass',
  'csrss',
  'smss',
  'winlogon',
  'explorer',
  'svchost',
  'dwm',
  'fontdrvhost',
  'sihost',
  'taskhostw',
  'runtimebroker',
  'searchindexer',
  'msmpeng',
  'securityhealthservice',
  'securityhealthsystray',
  'ironshield.agent.service',
  'edr.agent.service',
]);

const PROTECTED_PATH_FRAGMENTS = [
  'ironshield',
  'edr.agent',
  '\\windows\\system32\\',
  '\\windows\\syswow64\\',
];

const BLOCK_LIFECYCLE = Object.freeze([
  'requested',
  'pending_approval',
  'approved',
  'active',
  'failed',
  'expired',
  'cancelled',
  'rolled_back',
]);

function isProtectedSoftwareName(name) {
  if (!name) return false;
  const n = String(name).toLowerCase().trim();
  if (PROTECTED_PROCESS_NAMES.has(n)) return true;
  if (/ironshield|edr\.agent/i.test(n)) return true;
  if (/^(windows|microsoft) (defender|security)/i.test(n)) return true;
  return false;
}

function isProtectedPathPattern(pattern) {
  if (!pattern) return false;
  const p = String(pattern).toLowerCase();
  return PROTECTED_PATH_FRAGMENTS.some((frag) => p.includes(frag));
}

function isDangerousWildcard(policy) {
  const pathPat = policy.executable_path_pattern || '';
  if (!pathPat.includes('*')) return false;
  const stars = (pathPat.match(/\*/g) || []).length;
  if (stars >= 2) return true;
  if (pathPat.length < 20 && pathPat.includes('*')) return true;
  if (pathPat === '*' || pathPat === '*.*') return true;
  return false;
}

function validateBlockPolicy(policy, { isSuperAdmin = false } = {}) {
  const errors = [];
  if (!policy.software_name && !policy.executable_path_pattern) {
    errors.push('software_name or executable_path_pattern required');
  }
  if (policy.software_name && isProtectedSoftwareName(policy.software_name)) {
    errors.push('Cannot block protected system or agent software');
  }
  if (policy.executable_path_pattern && isProtectedPathPattern(policy.executable_path_pattern)) {
    errors.push('Cannot block protected system path pattern');
  }
  if (isDangerousWildcard(policy) && !isSuperAdmin) {
    errors.push('Dangerous wildcard block requires super_admin approval');
  }
  return { valid: errors.length === 0, errors };
}

async function auditLifecycleTransition({
  policyId,
  fromStatus,
  toStatus,
  actor,
  details = {},
}) {
  await AuditLogService.log({
    username: actor,
    action: 'software.block_lifecycle_transition',
    resourceType: 'software_block_policy',
    resourceId: String(policyId),
    details: { from: fromStatus, to: toStatus, ...details },
  });
}

module.exports = {
  PROTECTED_PROCESS_NAMES,
  BLOCK_LIFECYCLE,
  isProtectedSoftwareName,
  isProtectedPathPattern,
  isDangerousWildcard,
  validateBlockPolicy,
  auditLifecycleTransition,
};
