import React, { Suspense } from 'react';
import LoadingState from './LoadingState';

/**
 * Renders a lazy page inside a console tab; hides nested page headers.
 */
export default function EmbeddedPanel({ children, label = 'Loading module' }) {
  return (
    <div className="console-tab-panel" data-embedded>
      <Suspense fallback={<LoadingState label={label} />}>{children}</Suspense>
    </div>
  );
}
