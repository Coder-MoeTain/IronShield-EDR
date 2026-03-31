import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getBreadcrumbs } from '../utils/routeMeta';
import styles from './Breadcrumbs.module.css';

/**
 * Falcon-style wayfinding: Dashboard → Section → Detail
 */
export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav className={styles.nav} aria-label="Breadcrumb">
      <ol className={styles.list}>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={styles.item}>
              {!isLast && c.to ? (
                <Link to={c.to} className={styles.link}>
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? styles.current : styles.plain} aria-current={isLast ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
              {!isLast ? <span className={styles.sep} aria-hidden> / </span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
