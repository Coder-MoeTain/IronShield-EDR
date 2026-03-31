import React from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import styles from './NotFound.module.css';

/**
 * Dedicated 404 for unknown routes (SOC consoles should not silently redirect home).
 */
export default function NotFound() {
  return (
    <PageShell
      kicker="Navigation"
      title="Page not found"
      description="The URL does not match any view in this console. Use the sidebar, search, or go back to the dashboard."
      actions={
        <Link to="/" className="falcon-btn falcon-btn-primary">
          Dashboard
        </Link>
      }
    >
      <div className={styles.hint} role="region" aria-label="Suggestions">
        <p className={styles.line}>
          <strong>Tip:</strong> Press <kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>K</kbd> (
          <kbd className={styles.kbd}>⌘</kbd>+<kbd className={styles.kbd}>K</kbd> on Mac) to open global search.
        </p>
      </div>
    </PageShell>
  );
}
