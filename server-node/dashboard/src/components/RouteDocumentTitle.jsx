import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getDocumentTitle } from '../utils/routeMeta';

/** Sets document.title from current route (SOC console tab titles). */
export default function RouteDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(pathname);
  }, [pathname]);

  return null;
}
