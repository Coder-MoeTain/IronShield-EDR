import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiPath } from '../utils/apiPath';
import SeverityBadge from './SeverityBadge';
import StatusBadge from './StatusBadge';
import Timeline from './Timeline';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import styles from './EvidenceDrawer.module.css';

/**
 * Reusable evidence preview drawer for alerts, events, processes, network, IOCs, response actions.
 * @param {{ open: boolean, payload: object|null, onClose: function }} props
 */
export default function EvidenceDrawer({ open, payload, onClose }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !payload?.type || !payload?.id) {
      setData(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const path =
      payload.type === 'alert'
        ? `/api/admin/alerts/${payload.id}`
        : payload.type === 'event'
          ? `/api/admin/normalized-events/${payload.id}`
          : payload.type === 'endpoint'
            ? `/api/console/endpoints/${payload.id}`
            : payload.type === 'ioc'
              ? `/api/admin/iocs/${payload.id}`
              : null;

    if (!path) {
      setData(payload.preview || null);
      setLoading(false);
      return undefined;
    }

    api(apiPath(path))
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load evidence');
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json.alert || json.event || json.endpoint || json.ioc || json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, payload, api]);

  if (!open) return null;

  const title = payload?.title || `${payload?.type || 'Evidence'} #${payload?.id || ''}`;
  const detailPath =
    payload?.type === 'alert'
      ? `/detections/alerts/${payload.id}`
      : payload?.type === 'endpoint'
        ? `/endpoints/${payload.id}`
        : payload?.type === 'event'
          ? `/normalized-events/${payload.id}`
          : null;

  const timelineEvents = (data?.evidence || data?.timeline || payload?.timeline || []).map((ev, i) => ({
    id: ev.id || i,
    ts: ev.ts || ev.created_at,
    timeLabel: ev.timeLabel || ev.created_at,
    label: ev.label || ev.event_type || ev.title,
    detail: ev.detail || ev.description,
  }));

  return (
    <>
      <button type="button" className={styles.backdrop} aria-label="Close evidence" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {data?.severity ? <SeverityBadge severity={data.severity} /> : null}
            {data?.status ? <StatusBadge status={data.status} /> : null}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.body}>
          {loading ? <LoadingState label="Loading evidence" /> : null}
          {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
          {!loading && !error && data ? (
            <>
              {data.why_fired || data.evidence_summary ? (
                <section className={styles.section}>
                  <h3>Why it fired</h3>
                  <p className={styles.mono}>{data.why_fired || data.evidence_summary}</p>
                </section>
              ) : null}
              {data.matched_fields || data.mitre_technique ? (
                <section className={styles.section}>
                  <h3>Matched fields</h3>
                  <pre className={styles.pre}>
                    {JSON.stringify(data.matched_fields || { mitre: data.mitre_technique }, null, 2)}
                  </pre>
                </section>
              ) : null}
              {timelineEvents.length > 0 ? (
                <section className={styles.section}>
                  <h3>Evidence timeline</h3>
                  <Timeline events={timelineEvents} />
                </section>
              ) : null}
              {payload?.network ? (
                <section className={styles.section}>
                  <h3>Network</h3>
                  <pre className={styles.pre}>{JSON.stringify(payload.network, null, 2)}</pre>
                </section>
              ) : null}
            </>
          ) : null}
          {!loading && !error && !data && payload?.preview ? (
            <pre className={styles.pre}>{JSON.stringify(payload.preview, null, 2)}</pre>
          ) : null}
        </div>
        <footer className={styles.footer}>
          {detailPath ? (
            <Link to={detailPath} className="ui-btn ui-btn-primary" onClick={onClose}>
              Open full detail
            </Link>
          ) : null}
          <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
    </>
  );
}
