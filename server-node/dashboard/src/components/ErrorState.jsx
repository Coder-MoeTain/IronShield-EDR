import React from 'react';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="console-error ui-surface" role="alert">
      <h2 className="console-error-title">{title}</h2>
      {message ? <p className="console-error-msg">{message}</p> : null}
      {onRetry ? (
        <button type="button" className="ui-btn ui-btn-secondary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
