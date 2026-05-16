import React from 'react';
import PageShell from './PageShell';

/**
 * Standard chrome for compact console modules (wraps PageShell).
 */
export default function ConsolePage({
  kicker = 'Console',
  title,
  description,
  actions,
  tabs,
  loading,
  loadingLabel,
  children,
  className = '',
}) {
  return (
    <PageShell
      kicker={kicker}
      title={title}
      description={description}
      actions={actions}
      loading={loading}
      loadingLabel={loadingLabel}
      className={`console-page ${className}`.trim()}
    >
      {tabs}
      {children}
    </PageShell>
  );
}
