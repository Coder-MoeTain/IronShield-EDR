/**
 * Workspace modes: Simple SOC, Advanced Analyst, Admin, MSSP.
 * Persisted in localStorage; synced to server when available.
 */
import { canSeeMsspAndTenants } from './socRoles';

export const WORKSPACE_MODES = Object.freeze({
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
  ADMIN: 'admin',
  MSSP: 'mssp',
  AUDITOR: 'auditor',
});

const STORAGE_KEY = 'ironshield-workspace-mode';

export function readWorkspaceMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && Object.values(WORKSPACE_MODES).includes(v)) return v;
  } catch {
    /* ignore */
  }
  return WORKSPACE_MODES.ADVANCED;
}

export function writeWorkspaceMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('ironshield-workspace-mode', { detail: mode }));
  } catch {
    /* ignore */
  }
}

export function resolveWorkspaceMode(user, requested) {
  const mode = requested || readWorkspaceMode();
  if (mode === WORKSPACE_MODES.MSSP && !canSeeMsspAndTenants(user)) {
    return WORKSPACE_MODES.ADVANCED;
  }
  if (mode === WORKSPACE_MODES.AUDITOR) {
    const r = (user?.role || '').toLowerCase();
    if (r !== 'auditor' && r !== 'read_only' && user?.role !== 'viewer') {
      return WORKSPACE_MODES.ADVANCED;
    }
  }
  return mode;
}
