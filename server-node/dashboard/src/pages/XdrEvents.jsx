import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

export default function XdrEvents() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const source = searchParams.get('source') || '';
  const endpointId = searchParams.get('endpoint_id') || '';

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('limit', '200');
    if (source) qs.set('source', source);
    if (endpointId) qs.set('endpoint_id', endpointId);
    api(`/api/admin/xdr/events?${qs}`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [api, source, endpointId]);

  return (
    <PageShell
      kicker="XDR"
      title="XDR events"
      description="Canonical multi-source events stored in xdr_events (endpoint + web + auth + zeek)."
      actions={
        <>
          <select
            value={source}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.value) next.set('source', e.target.value);
              else next.delete('source');
              setSearchParams(next);
            }}
            className="falcon-btn falcon-btn-ghost"
          >
            <option value="">All sources</option>
            <option value="endpoint">endpoint</option>
            <option value="web">web</option>
            <option value="auth">auth</option>
            <option value="zeek">zeek</option>
          </select>
        </>
      }
    >
      {loading ? <p className="falcon-empty-desc">Loading…</p> : null}
      <div className="ui-surface" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Time</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Source</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Host</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>User</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Process</th>
              <th style={{ textAlign: 'left', padding: '0.6rem' }}>Dest</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                  No XDR events yet.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {fmt(r.timestamp)}
                </td>
                <td style={{ padding: '0.6rem' }}>{r.source}</td>
                <td style={{ padding: '0.6rem' }}>{r.event_type || '—'}</td>
                <td style={{ padding: '0.6rem' }}>
                  {r.endpoint_id ? <Link to={`/endpoints/${r.endpoint_id}`}>{r.host_name || `#${r.endpoint_id}`}</Link> : (r.host_name || '—')}
                </td>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {r.user_name || '—'}
                </td>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {r.process_name || '—'}
                </td>
                <td style={{ padding: '0.6rem' }} className="mono">
                  {r.destination_ip ? `${r.destination_ip}:${r.destination_port ?? ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

