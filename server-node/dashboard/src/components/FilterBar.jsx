import React from 'react';

export default function FilterBar({ children, actions }) {
  return (
    <div className="console-filter-bar">
      <div className="console-filter-fields">{children}</div>
      {actions ? <div className="console-filter-actions">{actions}</div> : null}
    </div>
  );
}
