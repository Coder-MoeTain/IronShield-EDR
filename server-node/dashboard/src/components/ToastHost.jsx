import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ToastHost.module.css';

export default function ToastHost({ toasts, onDismiss }) {
  if (typeof document === 'undefined' || !toasts?.length) return null;

  return createPortal(
    <div className={styles.region} role="region" aria-label="Notifications" aria-live="polite">
      <ul className={styles.list}>
        {toasts.map((t) => (
          <li
            key={t.id}
            className={`${styles.toast} ${styles[`toast--${t.variant}`] || ''}`}
            role="status"
          >
            <span className={styles.msg}>{t.message}</span>
            <button type="button" className={styles.dismiss} onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}
