import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmContext.module.css';

const ConfirmContext = createContext(null);

function ConfirmModal({ state, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const messageId = 'confirm-dialog-desc';

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return undefined;
    const buttons = [...root.querySelectorAll('button')].filter((b) => !b.disabled);
    const first = buttons[0];
    const t = window.setTimeout(() => first?.focus(), 0);
    const trap = (e) => {
      if (e.key !== 'Tab' || buttons.length === 0) return;
      const idx = buttons.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          buttons[buttons.length - 1].focus();
        }
      } else if (idx === buttons.length - 1 || idx === -1) {
        e.preventDefault();
        buttons[0].focus();
      }
    };
    root.addEventListener('keydown', trap);
    return () => {
      window.clearTimeout(t);
      root.removeEventListener('keydown', trap);
    };
  }, [state]);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={() => onClose(false)}
      onKeyDown={(e) => e.key === 'Escape' && onClose(false)}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={state.message ? messageId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {state.title}
        </h2>
        {state.message ? (
          <p id={messageId} className={styles.message}>
            {state.message}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={() => onClose(false)}>
            {state.cancelLabel}
          </button>
          <button
            type="button"
            className={`falcon-btn ${state.danger ? styles.danger : 'falcon-btn-primary'}`}
            onClick={() => onConfirm(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Replace window.confirm with accessible modal (SOC destructive actions).
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);
  const returnFocusRef = useRef(null);

  const finish = useCallback((ok) => {
    setState(null);
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.(ok);
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    window.requestAnimationFrame(() => {
      if (el && typeof el.focus === 'function') el.focus();
    });
  }, []);

  const confirm = useCallback((opts = {}) => {
    const {
      title = 'Confirm',
      message = '',
      confirmLabel = 'OK',
      cancelLabel = 'Cancel',
      danger = false,
    } = opts;
    return new Promise((resolve) => {
      returnFocusRef.current = document.activeElement;
      resolverRef.current = resolve;
      setState({ title, message, confirmLabel, cancelLabel, danger });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state &&
        createPortal(
          <ConfirmModal state={state} onClose={finish} onConfirm={finish} />,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
