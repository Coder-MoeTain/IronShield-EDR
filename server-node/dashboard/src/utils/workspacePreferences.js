/**
 * User workspace UI preferences (localStorage + optional server sync).
 */
import { WORKSPACE_MODES, readWorkspaceMode, writeWorkspaceMode } from './workspaceMode';

const STORAGE_KEY = 'ironshield-workspace-preferences';

export const DEFAULT_PREFERENCES = Object.freeze({
  workspace_mode: WORKSPACE_MODES.ADVANCED,
  default_landing_page: '/overview',
  sidebar_collapsed: false,
  table_density: 'comfortable',
});

export function readWorkspacePreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES, workspace_mode: readWorkspaceMode() };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, workspace_mode: readWorkspaceMode(), ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES, workspace_mode: readWorkspaceMode() };
  }
}

export function writeWorkspacePreferences(partial) {
  const next = { ...readWorkspacePreferences(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (partial.workspace_mode) writeWorkspaceMode(partial.workspace_mode);
    window.dispatchEvent(new CustomEvent('ironshield-workspace-preferences', { detail: next }));
  } catch {
    /* ignore */
  }
  return next;
}

export async function syncWorkspacePreferences(api, partial) {
  const prefs = writeWorkspacePreferences(partial);
  if (!api) return prefs;
  try {
    await api('/api/v1/admin/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
  } catch {
    /* server sync optional */
  }
  return prefs;
}
