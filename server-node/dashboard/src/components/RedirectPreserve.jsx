import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Redirect to a compact route while preserving query string and optional default tab.
 */
export default function RedirectPreserve({ to, defaultTab, defaultView }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (defaultTab && !params.has('tab')) params.set('tab', defaultTab);
  if (defaultView && !params.has('view')) params.set('view', defaultView);
  const search = params.toString();
  const target = `${to}${search ? `?${search}` : ''}${location.hash || ''}`;
  return <Navigate to={target} replace />;
}
