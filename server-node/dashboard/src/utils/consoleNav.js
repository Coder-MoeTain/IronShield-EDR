/**
 * Compact 8-page console navigation, UI modes, and role visibility.
 */
import {
  canSeeEnterpriseSettings,
  canSeeMsspAndTenants,
  canSeeRbacAdmin,
  isReadOnlyViewer,
} from './socRoles';

export const CONSOLE_UI_MODES = Object.freeze({
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
  ADMIN: 'admin',
});

const STORAGE_KEY = 'ironshield-console-ui-mode';

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
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && Object.values(CONSOLE_UI_MODES).includes(v)) return v;
  } catch {
    /* ignore */
  }
  return CONSOLE_UI_MODES.ADVANCED;
}

export function writeConsoleUiMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function isAuditorUser(user) {
  const r = (user?.role || '').toLowerCase();
  return r === 'auditor' || r === 'read_only';
}

export function canSeeAdminNav(user) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'admin' || user.role === 'tenant_admin') return true;
  return canSeeEnterpriseSettings(user) || canSeeMsspAndTenants(user) || canSeeRbacAdmin(user);
}

export function canSeeResponseNav(user, permissions = []) {
  if (isAuditorUser(user)) return false;
  if (isReadOnlyViewer(user)) return false;
  if (permissions.includes('*')) return true;
  return (
    permissions.includes('response:view') ||
    permissions.includes('response:request') ||
    permissions.includes('actions:write') ||
    user?.role === 'analyst' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'soc_manager' ||
    user?.role === 'senior_analyst'
  );
}

/** Paths visible in Simple mode */
const SIMPLE_PATHS = new Set(['/overview', '/endpoints', '/detections', '/investigation', '/protection']);

/** Paths visible in Admin mode */
const ADMIN_PATHS = new Set(['/overview', '/admin']);

/**
 * @param {object} user
 * @param {string[]} [permissions]
 * @param {string} [uiMode]
 */
export function getConsoleNavItems(user, permissions = [], uiMode = readConsoleUiMode()) {
  const mode = uiMode || CONSOLE_UI_MODES.ADVANCED;
  const auditor = isAuditorUser(user);

  return CONSOLE_NAV_ITEMS.filter((item) => {
    if (mode === CONSOLE_UI_MODES.SIMPLE && !SIMPLE_PATHS.has(item.path)) return false;
    if (mode === CONSOLE_UI_MODES.ADMIN && !ADMIN_PATHS.has(item.path)) return false;

    if (auditor) {
      return item.path === '/overview' || item.path === '/investigation' || item.path === '/admin';
    }

    if (item.requiresAdmin && !canSeeAdminNav(user)) return false;
    if (item.requiresResponse && !canSeeResponseNav(user, permissions)) return false;

    if (item.path === '/protection' && auditor) return false;

    return true;
  });
}

export function getDefaultConsolePath(user, permissions = [], uiMode = readConsoleUiMode()) {
  const items = getConsoleNavItems(user, permissions, uiMode);
  return items[0]?.path || '/overview';
}
