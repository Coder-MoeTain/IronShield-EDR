import React from 'react';

/**
 * Phase 3 — groups filter toolbar + table region + pagination footer for Falcon list pages.
 * All sections are optional; use only what the route needs.
 */
export default function FalconTableShell({ toolbar, children, footer, className = '' }) {
  return (
    <div className={`falcon-table-shell ${className}`.trim()}>
      {toolbar != null && <div className="falcon-table-shell-toolbar">{toolbar}</div>}
      <div className="falcon-table-shell-main">{children}</div>
      {footer != null && <div className="falcon-table-shell-footer">{footer}</div>}
    </div>
  );
}
