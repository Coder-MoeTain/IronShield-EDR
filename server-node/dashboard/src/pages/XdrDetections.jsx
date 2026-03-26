import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';

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

  useEffect(() => {
    setLoading(true);
    api('/api/admin/xdr/detections?limit=200')
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <PageShell
      kicker="XDR"
      title="XDR detections"
      description="Detections produced from canonical xdr_events (rule engine baseline)."
    >
      {loading ? <p className="falcon-empty-desc">Loading…</p> : null}
      <div className="ui-surface" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Event time</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Host</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Source</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Rule</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Risk</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                  No XDR detections yet.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {r.id}
                </td>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {fmt(r.event_timestamp)}
                </td>
                <td style={{ padding: '0.6rem' }}>
                  {r.endpoint_id ? <Link to={`/endpoints/${r.endpoint_id}`}>#{r.endpoint_id}</Link> : '—'}
                </td>
                <td style={{ padding: '0.6rem' }}>{r.event_source || '—'}</td>
                <td style={{ padding: '0.6rem' }}>{r.event_type || '—'}</td>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {r.rule_name || r.rule_id || '—'}
                </td>
                <td style={{ padding: '0.6rem' }}>{r.risk_score ?? '—'}</td>
                <td style={{ padding: '0.6rem' }}>{r.confidence ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

