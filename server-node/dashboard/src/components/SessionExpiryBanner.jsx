import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getJwtExpiryMs } from '../utils/jwt';
import styles from './SessionExpiryBanner.module.css';

const WARN_MS = 5 * 60 * 1000;
const TICK_MS = 15_000;

/**
 * Warn analysts before JWT expiry so they can save work / expect re-auth (SOC consoles standard pattern).
 */
export default function SessionExpiryBanner() {
  const { token } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  const expMs = useMemo(() => getJwtExpiryMs(token), [token]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  if (!expMs) return null;

  const msLeft = expMs - now;
  if (msLeft <= 0 || msLeft > WARN_MS) return null;

  const min = Math.max(1, Math.ceil(msLeft / 60_000));

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.icon} aria-hidden>
        ⏱
      </span>
      <span>
        Session expires in about <strong>{min}</strong> minute{min === 1 ? '' : 's'}. Save work; you may be signed out when the token expires.
      </span>
    </div>
  );
}
