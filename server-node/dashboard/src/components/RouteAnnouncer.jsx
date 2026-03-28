import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getBreadcrumbs } from '../utils/routeMeta';

/**
 * SPA route change announcements for screen-reader users (WCAG 4.1.3).
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');

  useEffect(() => {
    const crumbs = getBreadcrumbs(pathname);
    const last = crumbs[crumbs.length - 1];
    const label = last?.label || 'Page';
    setMessage(`Navigated to ${label}`);
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
