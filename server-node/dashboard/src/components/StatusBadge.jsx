import React from 'react';

const TONE = {
  online: 'ok',
  offline: 'bad',
  open: 'warn',
  closed: 'muted',
  pending: 'warn',
  approved: 'ok',
  denied: 'bad',
};

export default function StatusBadge({ status, children }) {
  const raw = (status || children || 'unknown').toString();
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  const tone = TONE[key] || 'muted';
  return <span className={`console-status console-status-${tone}`}>{children ?? raw}</span>;
}
