import React from 'react';
import {
  CONSOLE_UI_MODES,
  readConsoleUiMode,
  writeConsoleUiMode,
} from '../utils/consoleNav';
import styles from './ConsoleModeToggle.module.css';

export function useConsoleUiMode() {
  const [mode, setModeState] = React.useState(readConsoleUiMode);

  const setMode = React.useCallback((next) => {
    writeConsoleUiMode(next);
    setModeState(next);
    window.dispatchEvent(new CustomEvent('ironshield-console-mode', { detail: next }));
  }, []);

  React.useEffect(() => {
    const onMode = (e) => setModeState(e.detail || readConsoleUiMode());
    window.addEventListener('ironshield-console-mode', onMode);
    return () => window.removeEventListener('ironshield-console-mode', onMode);
  }, []);

  return [mode, setMode];
}

export default function ConsoleModeToggle() {
  const [mode, setMode] = useConsoleUiMode();

  return (
    <div className={styles.wrap} role="group" aria-label="Console UI mode">
      <label className={styles.label} htmlFor="console-ui-mode">
        UI mode
      </label>
      <select
        id="console-ui-mode"
        className={styles.select}
        value={mode}
        onChange={(e) => setMode(e.target.value)}
      >
        <option value={CONSOLE_UI_MODES.SIMPLE}>Simple</option>
        <option value={CONSOLE_UI_MODES.ADVANCED}>Advanced</option>
        <option value={CONSOLE_UI_MODES.ADMIN}>Admin</option>
      </select>
    </div>
  );
}
