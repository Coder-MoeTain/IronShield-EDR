import React from 'react';
import { useAuth } from '../context/AuthContext';
import { canSeeMsspAndTenants, isAuditorRole } from '../utils/socRoles';
import { readWorkspacePreferences, writeWorkspacePreferences } from '../utils/workspacePreferences';
import { WORKSPACE_MODES, readWorkspaceMode, writeWorkspaceMode } from '../utils/workspaceMode';
import styles from './ConsoleModeToggle.module.css';

export function useConsoleUiMode() {
  const [mode, setModeState] = React.useState(readWorkspaceMode);

  const setMode = React.useCallback((next) => {
    writeWorkspaceMode(next);
    writeWorkspacePreferences({ workspace_mode: next });
    setModeState(next);
  }, []);

  React.useEffect(() => {
    const onMode = (e) => setModeState(e.detail || readWorkspaceMode());
    window.addEventListener('ironshield-workspace-mode', onMode);
    return () => window.removeEventListener('ironshield-workspace-mode', onMode);
  }, []);

  return [mode, setMode];
}

export default function ConsoleModeToggle({ collapsed = false }) {
  const { user } = useAuth();
  const [mode, setMode] = useConsoleUiMode();
  const showMssp = canSeeMsspAndTenants(user);
  const showAuditor = isAuditorRole(user) || user?.role === 'viewer';

  React.useEffect(() => {
    const prefs = readWorkspacePreferences();
    if (prefs.workspace_mode) setMode(prefs.workspace_mode);
  }, [setMode]);

  return (
    <div
      className={`${styles.wrap} ${collapsed ? styles.wrapCollapsed : ''}`}
      role="group"
      aria-label="Workspace mode"
    >
      <label className={styles.label} htmlFor="workspace-mode" title={collapsed ? 'Workspace' : undefined}>
        {collapsed ? 'Mode' : 'Workspace'}
      </label>
      <select
        id="workspace-mode"
        className={styles.select}
        value={mode}
        onChange={(e) => setMode(e.target.value)}
      >
        <option value={WORKSPACE_MODES.SIMPLE}>Simple SOC</option>
        <option value={WORKSPACE_MODES.ADVANCED}>Advanced Analyst</option>
        <option value={WORKSPACE_MODES.ADMIN}>Admin</option>
        {showMssp ? <option value={WORKSPACE_MODES.MSSP}>MSSP</option> : null}
        {showAuditor ? <option value={WORKSPACE_MODES.AUDITOR}>Auditor</option> : null}
      </select>
    </div>
  );
}
