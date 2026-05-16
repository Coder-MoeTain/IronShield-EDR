import React, { useEffect } from 'react';
import styles from './DetailDrawer.module.css';

/**
 * Right-side preview drawer for alerts, events, endpoints, etc.
 */
export default function DetailDrawer({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close drawer" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={title || 'Details'}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </aside>
    </>
  );
}
