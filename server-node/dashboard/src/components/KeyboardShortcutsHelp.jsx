import React, { useEffect, useState, useCallback } from 'react';
import styles from './KeyboardShortcutsHelp.module.css';

const ROWS = [
  { keys: ['Ctrl', 'K'], keysMac: ['⌘', 'K'], desc: 'Focus global search' },
  { keys: ['Esc'], keysMac: ['Esc'], desc: 'Close search results (when open)' },
  { keys: ['?'], keysMac: ['?'], desc: 'Toggle this shortcuts panel (outside text fields)' },
  { keys: ['Tab'], keysMac: ['Tab'], desc: 'Move focus between controls' },
];

function Kbd({ children }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const onKey = useCallback(
    (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const t = e.target;
        const tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    },
    [open]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts (?)"
        aria-expanded={open}
        aria-controls="kbd-shortcuts-dialog"
      >
        <span className={styles.triggerIcon} aria-hidden>
          ⌨
        </span>
        <span className={styles.triggerLabel}>Shortcuts</span>
      </button>

      {open ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        >
          <div
            id="kbd-shortcuts-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kbd-shortcuts-title"
            className={styles.dialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogHead}>
              <h2 id="kbd-shortcuts-title" className={styles.dialogTitle}>
                Keyboard shortcuts
              </h2>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className={styles.hint}>Press <Kbd>?</Kbd> outside fields to toggle this panel.</p>
            <ul className={styles.rows}>
              {ROWS.map((row) => (
                <li key={row.desc} className={styles.row}>
                  <span className={styles.desc}>{row.desc}</span>
                  <span className={styles.keys}>
                    {(mac ? row.keysMac : row.keys).map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
