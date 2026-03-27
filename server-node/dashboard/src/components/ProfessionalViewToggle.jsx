import React, { useState, useEffect } from 'react';
import styles from './ProfessionalViewToggle.module.css';

const STORAGE_KEY = 'ironshield-professional-view';

/**
 * Immersive “professional” layout: hides the sidebar rail for maximum workspace.
 * Complements browser fullscreen — this is app chrome, not document.fullscreen.
 */
export function useProfessionalView() {
  const [professionalView, setProfessionalView] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, professionalView ? '1' : '0');
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-professional-view', professionalView ? 'true' : 'false');
  }, [professionalView]);

  return [professionalView, setProfessionalView];
}

export default function ProfessionalViewToggle({ professionalView, onToggle }) {
  const active = Boolean(professionalView);
  return (
    <button
      type="button"
      className={`${styles.wrap} ${active ? styles.wrapActive : ''}`}
      onClick={() => onToggle(!active)}
      title={
        active
          ? 'Return to standard layout with full navigation rail'
          : 'Professional view: hide navigation rail and maximize workspace for analysis'
      }
      aria-pressed={active}
      aria-label={
        active
          ? 'Standard layout: show full navigation sidebar'
          : 'Professional view: hide sidebar and expand workspace'
      }
    >
      <span className={styles.icon} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            d="M4 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M20 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{active ? 'Standard layout' : 'Professional view'}</span>
        <span className={styles.hint}>{active ? 'Show navigation rail' : 'Max workspace · hide rail'}</span>
      </span>
    </button>
  );
}
