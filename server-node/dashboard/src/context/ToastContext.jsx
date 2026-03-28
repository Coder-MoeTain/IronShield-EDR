import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import ToastHost from '../components/ToastHost';

const ToastContext = createContext(null);

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `toast-${idSeq}`;
}

const DEDUP_MS = 4000;

/**
 * SOC console toast queue: errors, confirmations, and short operational notices.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const recentRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ message, variant = 'info', durationMs }) => {
      if (!message || typeof message !== 'string') return;
      const key = `${variant}::${message}`;
      const now = Date.now();
      const last = recentRef.current.get(key);
      if (last != null && now - last < DEDUP_MS) return;
      recentRef.current.set(key, now);
      const id = nextId();
      const defaultDur = variant === 'error' ? 9000 : variant === 'success' ? 4500 : 5500;
      const dur = durationMs != null ? durationMs : defaultDur;
      setToasts((prev) => [...prev.slice(-6), { id, message, variant, durationMs: dur }]);
      if (dur > 0) {
        setTimeout(() => removeToast(id), dur);
      }
    },
    [removeToast]
  );

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
