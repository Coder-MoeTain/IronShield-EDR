import React from 'react';
import styles from '../../features/protection/tabs/SoftwareRiskTab.module.css';

export function ModalShell({ open, title, onClose, onSubmit, children, submitLabel = 'Submit' }) {
  if (!open) return null;
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {children}
        <div className={styles.modalActions}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} onClick={onSubmit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function NotifyUpdateModal({ open, selected, form, setForm, onClose, onSubmit }) {
  return (
    <ModalShell open={open} title={`Notify update: ${selected?.name}`} onClose={onClose} onSubmit={onSubmit} submitLabel="Send notification">
      <input placeholder="Title (optional)" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="Message (optional)" value={form.message || ''} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} />
    </ModalShell>
  );
}

export function NotifyUninstallModal({ open, selected, form, setForm, onClose, onSubmit }) {
  return (
    <ModalShell open={open} title={`Notify uninstall: ${selected?.name}`} onClose={onClose} onSubmit={onSubmit} submitLabel="Send notification">
      <input placeholder="Title (optional)" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="Message (optional)" value={form.message || ''} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} />
    </ModalShell>
  );
}

export function BlockModal({ open, selected, form, setForm, onClose, onSubmit }) {
  return (
    <ModalShell open={open} title={`Block execution: ${selected?.name}`} onClose={onClose} onSubmit={onSubmit} submitLabel="Request block">
      <textarea placeholder="Reason (required)" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} />
      <input placeholder="Approver username (high-risk)" value={form.approved_by || ''} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} />
      <input type="datetime-local" value={form.expires_at || ''} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
    </ModalShell>
  );
}

export function AcceptRiskModal({ open, selected, form, setForm, onClose, onSubmit }) {
  return (
    <ModalShell open={open} title={`Accept risk: ${selected?.name}`} onClose={onClose} onSubmit={onSubmit} submitLabel="Accept risk">
      <textarea placeholder="Reason (required)" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} />
      <input type="datetime-local" value={form.until || ''} onChange={(e) => setForm({ ...form, until: e.target.value })} />
    </ModalShell>
  );
}
