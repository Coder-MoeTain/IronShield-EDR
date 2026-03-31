import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import { falconSeverityClass } from '../utils/falconUi';
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

export default function XdrDetections() {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [endpointId, setEndpointId] = useState('');
  const [offset, setOffset] = useState(0);

  const fetchRows = useCallback(() => {
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams();
    qs.set('limit', String(LIMIT));
    qs.set('offset', String(offset));
    if (endpointId) qs.set('endpoint_id', endpointId);
    api(`/api/admin/xdr/detections?${qs}`)
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
  }, [api, endpointId, offset]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=300')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : d?.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [api]);

  return (
    <PageShell
      kicker="XDR"
      title="XDR detections"
      description="Detections derived from canonical xdr_events — rule engine output with risk and confidence for triage."
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
                Endpoint
                <select
                  className={styles.select}
                  value={endpointId}
                  onChange={(e) => {
                    setEndpointId(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="">All hosts</option>
                  {endpoints.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.hostname || e.name || `#${e.id}`}
                    </option>
                  ))}
                </select>
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
              title="No XDR detections"
              description="Confirm detection rules are enabled and events are flowing into the XDR pipeline."
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Event time</th>
                    <th>Host</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th>Rule</th>
                    <th>Severity</th>
                    <th>Risk</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.mono}>{r.id}</td>
                      <td className={styles.mono}>{fmt(r.event_timestamp)}</td>
                      <td>
                        {r.endpoint_id ? (
                          <Link to={`/endpoints/${r.endpoint_id}`}>#{r.endpoint_id}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.event_source || '—'}</td>
                      <td className={styles.mono}>{r.event_type || '—'}</td>
                      <td className={styles.mono}>{r.rule_name || r.rule_id || '—'}</td>
                      <td>
                        {r.severity ? (
                          <span className={falconSeverityClass(r.severity)}>{r.severity}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.mono}>{r.risk_score ?? '—'}</td>
                      <td className={styles.mono}>{r.confidence ?? '—'}</td>
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
