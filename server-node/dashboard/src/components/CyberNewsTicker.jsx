import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './CyberNewsTicker.module.css';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CyberNewsTicker() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    setErr(null);
    api('/api/admin/dashboard/cyber-news')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setFetchedAt(data.fetchedAt || null);
      })
      .catch((e) => {
        setErr(e?.message || 'Failed to load feed');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const list = useMemo(() => {
    if (!items.length) return [];
    return items;
  }, [items]);

  const durationSec = useMemo(() => {
    const n = list.length;
    if (n === 0) return 30;
    return Math.min(120, Math.max(36, Math.round(n * 2.8)));
  }, [list.length]);

  const trackStyle = useMemo(
    () => ({
      animationDuration: `${durationSec}s`,
    }),
    [durationSec]
  );

  return (
    <section className={styles.panel} aria-label="Cybersecurity news feed">
      <div className={styles.head}>
        <span className={styles.liveBadge} title="RSS sources refresh on the server every few minutes">
          <span className={styles.liveDot} aria-hidden />
          LIVE
        </span>
        <h2 className={styles.title}>Cyber intelligence stream</h2>
        <span className={styles.sub}>
          External RSS — security news only
          {fetchedAt ? ` · ${formatTime(fetchedAt)}` : null}
        </span>
        <button type="button" className={styles.refreshBtn} onClick={() => { setLoading(true); load(); }} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      {warnings.length > 0 && !err && (
        <p className={styles.warn} role="status">
          Some sources skipped: {warnings.slice(0, 2).join(' · ')}
        </p>
      )}

      {err && <p className={styles.error}>{err}</p>}

      {!loading && !err && list.length === 0 && <p className={styles.empty}>No headlines available right now.</p>}

      {list.length > 0 && (
        <div className={styles.viewport}>
          <div className={styles.track} style={trackStyle}>
            {list.map((it, i) => (
              <a
                key={`a-${i}-${it.link}`}
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.item}
              >
                <span className={styles.source}>{it.source}</span>
                <span className={styles.headline}>{it.title}</span>
                <time className={styles.time} dateTime={it.publishedAt}>
                  {formatTime(it.publishedAt)}
                </time>
              </a>
            ))}
            {list.map((it, i) => (
              <a
                key={`b-${i}-${it.link}`}
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.item}
              >
                <span className={styles.source}>{it.source}</span>
                <span className={styles.headline}>{it.title}</span>
                <time className={styles.time} dateTime={it.publishedAt}>
                  {formatTime(it.publishedAt)}
                </time>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
