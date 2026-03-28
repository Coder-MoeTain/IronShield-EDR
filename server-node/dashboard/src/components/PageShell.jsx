import React from 'react';

/**
 * CrowdStrike Falcon–style page chrome: full-width main column, kicker, title, optional actions.
 * Use across dashboard routes for consistent EDR console layout.
 */
export default function PageShell({
  kicker,
  title,
  description,
  actions,
  children,
  loading,
  loadingLabel = 'Loading',
  className = '',
}) {
  if (loading) {
    return (
      <div className={`ui-page falcon-page ${className}`.trim()}>
        <div className="ui-loading" role="status">
          {loadingLabel}
        </div>
      </div>
    );
  }

  return (
    <div className={`ui-page falcon-page ${className}`.trim()}>
      {(kicker || title || description || actions) && (
        <header className="ui-page-header">
          <div className="ui-page-header-row">
            <div className="ui-page-header-text">
              {kicker && <span className="ui-kicker">{kicker}</span>}
              {title && <h1 className="ui-page-title">{title}</h1>}
              {description && <p className="ui-page-desc">{description}</p>}
            </div>
            {actions && <div className="ui-page-actions">{actions}</div>}
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
