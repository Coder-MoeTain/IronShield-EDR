import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import styles from './XdrWorkspace.module.css';

const LIMIT = 75;

function fmt(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

export default function XdrEvents() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [offset, setOffset] = useState(0);

  const source = searchParams.get('source') || '';
  const endpointId = searchParams.get('endpoint_id') || '';
  const eventType = searchParams.get('event_type') || '';

  const fetchRows = useCallback(() => {
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams();
    qs.set('limit', String(LIMIT));
    qs.set('offset', String(offset));
    if (source) qs.set('source', source);
    if (endpointId) qs.set('endpoint_id', endpointId);
    if (eventType.trim()) qs.set('event_type', eventType.trim());
    api(`/api/admin/xdr/events?${qs}`)
      .then(async (r) => {
        const j = await r.json().catch(() => []);
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setRows(Array.isArray(j) ? j : []);
      })
      .catch((e) => {
        setErr(e.message || 'Failed to load');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [api, source, endpointId, eventType, offset]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=300')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : d?.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [api]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value == null) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
    setOffset(0);
  };

  return (
    <PageShell
      kicker="XDR"
      title="XDR events"
      description="Canonical multi-source events in xdr_events (endpoint, web, auth, Zeek). Filter by source, host, and type."
      actions={
        <>
          <Link to="/xdr" className="falcon-btn falcon-btn-ghost">
            ← XDR hub
          </Link>
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={fetchRows} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </>
      }
    >
      <div className={styles.wrap}>
        {err && (
          <div className={styles.errorBanner} role="alert">
            {err}
          </div>
        )}

        <FalconTableShell
          toolbar={
            <div className={styles.toolbar}>
              <label>
                Source
                <select
                  className={styles.select}
                  value={source}
                  onChange={(e) => setFilter('source', e.target.value)}
                >
                  <option value="">All sources</option>
                  <option value="endpoint">endpoint</option>
                  <option value="web">web</option>
                  <option value="auth">auth</option>
                  <option value="zeek">zeek</option>
                </select>
              </label>
              <label>
                Endpoint
                <select
                  className={styles.select}
                  value={endpointId}
                  onChange={(e) => setFilter('endpoint_id', e.target.value)}
                >
                  <option value="">All hosts</option>
                  {endpoints.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.hostname || e.name || `#${e.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Event type
                <input
                  className={styles.input}
                  style={{ minWidth: '200px' }}
                  placeholder="e.g. process_create"
                  value={eventType}
                  onChange={(e) => setFilter('event_type', e.target.value)}
                />
              </label>
              <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="falcon-btn falcon-btn-ghost"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="falcon-btn falcon-btn-ghost"
                  disabled={rows.length < LIMIT}
                  onClick={() => setOffset((o) => o + LIMIT)}
                >
                  Next
                </button>
              </div>
            </div>
          }
        >
          {loading && rows.length === 0 ? (
            <p className="falcon-empty-desc" style={{ padding: '1rem' }}>
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <FalconEmptyState
              title="No XDR events"
              description="Adjust filters or confirm agents are sending telemetry and the XDR pipeline is writing to xdr_events."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th>Host</th>
                    <th>User</th>
                    <th>Process</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.mono}>{fmt(r.timestamp)}</td>
                      <td>
                        <span className={styles.sourcePill}>{r.source || '—'}</span>
                      </td>
                      <td className={styles.mono}>{r.event_type || '—'}</td>
                      <td>
                        {r.endpoint_id ? (
                          <Link to={`/endpoints/${r.endpoint_id}`}>{r.host_name || `#${r.endpoint_id}`}</Link>
                        ) : (
                          r.host_name || '—'
                        )}
                      </td>
                      <td className={styles.mono}>{r.user_name || '—'}</td>
                      <td className={styles.mono}>{r.process_name || '—'}</td>
                      <td className={`${styles.mono} ${styles.destCell}`}>
                        {r.destination_ip ? `${r.destination_ip}:${r.destination_port ?? ''}` : '—'}
                      </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FalconTableShell>
        {!loading && rows.length > 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Offset {offset} · up to {LIMIT} rows per page
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}
