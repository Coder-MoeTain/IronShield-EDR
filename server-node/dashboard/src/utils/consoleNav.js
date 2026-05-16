/**
 * Compact 8-page console navigation filtered by workspace mode and RBAC.
 */
import {
  canSeeEnterpriseSettings,
  canSeeMsspAndTenants,
  canSeeRbacAdmin,
  isAuditorRole,
  isReadOnlyViewer,
} from './socRoles';
import { WORKSPACE_MODES, readWorkspaceMode, resolveWorkspaceMode } from './workspaceMode';

/** @deprecated use WORKSPACE_MODES */
export const CONSOLE_UI_MODES = WORKSPACE_MODES;

const STORAGE_KEY = 'ironshield-workspace-mode';

export const CONSOLE_NAV_ITEMS = [
  { path: '/overview', label: 'Overview', end: true },
  { path: '/endpoints', label: 'Endpoints' },
  { path: '/detections', label: 'Detections' },
  { path: '/investigation', label: 'Investigation' },
  { path: '/response', label: 'Response', requiresResponse: true },
  { path: '/hunting', label: 'Threat Hunting' },
  { path: '/protection', label: 'Protection' },
  { path: '/admin', label: 'Administration', requiresAdmin: true },
];

export function readConsoleUiMode() {
  return readWorkspaceMode();
}

export function writeConsoleUiMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('ironshield-workspace-mode', { detail: mode }));
  } catch {
    /* ignore */
  }
}

export function isAuditorUser(user) {
  return isAuditorRole(user);
}

export function canSeeAdminNav(user) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'admin' || user.role === 'tenant_admin') return true;
  return canSeeEnterpriseSettings(user) || canSeeMsspAndTenants(user) || canSeeRbacAdmin(user);
}

export function canSeeResponseNav(user, permissions = []) {
  if (isAuditorUser(user) || isReadOnlyViewer(user)) return false;
  if (permissions.includes('*')) return true;
  return (
    permissions.includes('response:view') ||
    permissions.includes('response:request') ||
    permissions.includes('actions:write') ||
    ['analyst', 'admin', 'super_admin', 'soc_manager', 'senior_analyst', 'tenant_admin'].includes(
      user?.role
    )
  );
}

const SIMPLE_PATHS = new Set(['/overview', '/endpoints', '/detections', '/investigation', '/protection']);
const ADMIN_PATHS = new Set(['/overview', '/admin']);
const MSSP_PATHS = new Set(['/overview', '/endpoints', '/detections', '/investigation', '/admin']);
const AUDITOR_PATHS = new Set(['/overview', '/investigation', '/admin']);

export function getConsoleNavItems(user, permissions = [], uiMode = readWorkspaceMode()) {
  const mode = resolveWorkspaceMode(user, uiMode);
  const auditor = isAuditorUser(user);

  return CONSOLE_NAV_ITEMS.filter((item) => {
    if (mode === WORKSPACE_MODES.SIMPLE && !SIMPLE_PATHS.has(item.path)) return false;
    if (mode === WORKSPACE_MODES.ADMIN && !ADMIN_PATHS.has(item.path)) return false;
    if (mode === WORKSPACE_MODES.MSSP && !MSSP_PATHS.has(item.path)) return false;
    if (mode === WORKSPACE_MODES.AUDITOR && !AUDITOR_PATHS.has(item.path)) return false;

    if (auditor) {
      return AUDITOR_PATHS.has(item.path);
    }

    if (item.requiresAdmin && !canSeeAdminNav(user)) return false;
    if (item.requiresResponse && !canSeeResponseNav(user, permissions)) return false;

    return true;
  });
}

export function getDefaultConsolePath(user, permissions = [], uiMode = readWorkspaceMode()) {
  const items = getConsoleNavItems(user, permissions, uiMode);
  return items[0]?.path || '/overview';
}
