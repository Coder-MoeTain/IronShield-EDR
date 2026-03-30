import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './ProtectionCapabilities.module.css';

function statusClass(status) {
  if (status === 'full') return styles.badgeFull;
  if (status === 'partial') return styles.badgePartial;
  return styles.badgePlanned;
}

export default function ProtectionCapabilities() {
  const { api } = useAuth();
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    api('/api/admin/platform/protection-capabilities')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then(setPayload)
      .catch((e) => {
        setPayload(null);
        setErr(e.message || 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const caps = payload?.capabilities ?? [];

  return (
    <PageShell
      kicker="Platform"
      title="Endpoint protection capabilities"
      description="How IronShield maps to standard endpoint security areas. Status labels reflect the open agent and server — not a third-party SKU."
      actions={
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={load}>
          Refresh
        </button>
      }
    >
      <div className={styles.page}>
        {err ? <p className={styles.err}>{err}</p> : null}
        {loading && !payload ? <p className="ui-loading">Loading capability map…</p> : null}

        {payload ? (
          <>
            <div className={styles.intro}>
              <p>
                <strong>{payload.product}</strong> — consolidated view of malware defense, intelligence, and operations.
                Use this page with <Link to="/av">NGAV</Link>, <Link to="/detection-rules">detection rules</Link>,{' '}
                <Link to="/web-url-protection">Web & URL</Link>, and <Link to="/iocs">IOCs</Link> for day-to-day configuration.
              </p>
              {payload.disclaimer ? <p className={styles.disclaimer}>{payload.disclaimer}</p> : null}
              {payload.generated_at ? (
                <p className={styles.meta}>Generated {new Date(payload.generated_at).toLocaleString()}</p>
              ) : null}
            </div>

            <div className={styles.grid}>
              {caps.map((c) => (
                <article key={c.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{c.title}</h2>
                    <span className={`${styles.badge} ${statusClass(c.status)}`} title={c.status}>
                      {c.status_label || c.status}
                    </span>
                  </div>
                  <p className={styles.summary}>{c.summary}</p>
                  {Array.isArray(c.bullets) && c.bullets.length > 0 ? (
                    <ul className={styles.bullets}>
                      {c.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {Array.isArray(c.links) && c.links.length > 0 ? (
                    <div className={styles.links}>
                      {c.links.map((l) => (
                        <Link key={l.path + l.label} to={l.path} className={styles.link}>
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
