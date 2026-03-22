import React from 'react';

/**
 * CrowdStrike-style empty list / no-results panel (Phase 2).
 * @param {{ title: string, description?: string, icon?: string, children?: React.ReactNode, className?: string }} props
 */
export default function FalconEmptyState({
  title,
  description,
  icon,
  children,
  className = '',
}) {
  return (
    <div
      className={`falcon-empty ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {icon != null && icon !== '' && <span className="falcon-empty-icon" aria-hidden>{icon}</span>}
      <div className="falcon-empty-text">
        <p className="falcon-empty-title">{title}</p>
        {description && <p className="falcon-empty-desc">{description}</p>}
      </div>
      {children && <div className="falcon-empty-actions">{children}</div>}
    </div>
  );
}
