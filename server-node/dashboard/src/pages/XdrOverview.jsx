import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import styles from './XdrWorkspace.module.css';

export default function XdrOverview() {
  const { api } = useAuth();
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    api('/api/admin/xdr/summary')
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setSummary(j);
      })
      .catch((e) => {
        setErr(e.message || 'Failed to load XDR summary');
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const s = summary || {};

  return (
    <PageShell
      kicker="XDR"
      title="Extended detection & response"
      actions={
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <div className={styles.wrap}>
        {err && (
          <div className={styles.errorBanner} role="alert">
            {err}
            <div style={{ marginTop: '0.5rem' }}>
              <button type="button" className="falcon-btn falcon-btn-ghost" onClick={load}>
                Retry
              </button>
            </div>
          </div>
        )}

        {loading && !summary && !err ? (
          <p className="falcon-empty-desc">Loading XDR summary…</p>
        ) : (
          <div className={styles.statRow}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{s.events_total ?? '—'}</span>
              <span className={styles.statLabel}>Events (total)</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{s.events_last_24h ?? '—'}</span>
              <span className={styles.statLabel}>Events (24h)</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{s.detections_total ?? '—'}</span>
              <span className={styles.statLabel}>Detections</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>
                {s.detections_critical != null || s.detections_high != null
                  ? `${s.detections_critical ?? 0} / ${s.detections_high ?? 0}`
                  : '—'}
              </span>
              <span className={styles.statLabel}>Critical / High</span>
            </div>
          </div>
        )}

        <div className={styles.overviewGrid}>
          <Link className={styles.linkCard} to="/xdr/events">
            <h3>XDR events</h3>
            <p>Browse canonical rows from endpoint, web, auth, and Zeek sources with filters.</p>
          </Link>
          <Link className={styles.linkCard} to="/xdr/detections">
            <h3>XDR detections</h3>
            <p>Detections produced from canonical events — rule names, risk, and confidence.</p>
          </Link>
          <Link className={styles.linkCard} to="/xdr/realtime">
            <h3>Live stream</h3>
            <p>WebSocket bridge: XDR events, detections, and raw Kafka payloads with stream filters.</p>
          </Link>
        </div>

        <div className={styles.pipeline}>
          <strong>Pipeline</strong>: agents and collectors → ingestion / normalization →{' '}
          <code style={{ fontSize: '0.85em' }}>xdr_events</code> / rules →{' '}
          <code style={{ fontSize: '0.85em' }}>xdr_detections</code>
          {', '}
          optional Kafka fan-out for realtime dashboards.
        </div>

        {!loading && summary && (s.events_total ?? 0) === 0 && (s.detections_total ?? 0) === 0 ? (
          <FalconEmptyState
            title="No XDR data yet"
            description="Ingest telemetry from enrolled agents and enable Kafka (optional) to populate this workspace."
          />
        ) : null}
      </div>
    </PageShell>
  );
}
