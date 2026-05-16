import React from 'react';

export default function LoadingState({ label = 'Loading' }) {
  return (
    <div className="ui-loading console-loading" role="status" aria-live="polite">
      {label}
    </div>
  );
}
