import React from 'react';
import FalconTableShell from './FalconTableShell';

/** Thin wrapper around FalconTableShell for console modules. */
export default function DataTable({ toolbar, footer, children, className = '' }) {
  return (
    <FalconTableShell toolbar={toolbar} footer={footer} className={className}>
      {children}
    </FalconTableShell>
  );
}
