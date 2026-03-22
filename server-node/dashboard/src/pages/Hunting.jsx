import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './Endpoints.module.css';

const DEFAULT_FILTERS = {
  eventType: '',
  hostname: '',
  processName: '',
  commandLine: '',
  dnsQuery: '',
  dateFrom: '',
  dateTo: '',
  limit: 50,
};

export default function Hunting() {
  const { api } = useAuth();
  const [hunts, setHunts] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [huntName, setHuntName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadHunts = () => {
    api('/api/admin/hunt-queries')
      .then((r) => r.json())
      .then(setHunts)
      .catch(() => setHunts([]));
  };

  useEffect(() => {
    loadHunts();
  }, [api]);

  const buildQueryParams = () => {
    const q = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) q[k] = k === 'limit' ? parseInt(v, 10) || 50 : v;
    });
    return q;
  };

  const runAdhoc = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api('/api/admin/hunt-queries/run-adhoc', {
        method: 'POST',
        body: JSON.stringify(buildQueryParams()),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Hunt failed');
      setResult(j);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const saveHunt = async () => {
    if (!huntName.trim()) {
      window.alert('Enter a name for this hunt');
      return;
    }
    await api('/api/admin/hunt-queries', {
      method: 'POST',
      body: JSON.stringify({ name: huntName.trim(), query_params: buildQueryParams() }),
    });
    setHuntName('');
    loadHunts();
  };

  const runSaved = async (id) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api(`/api/admin/hunt-queries/${id}/run`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Run failed');
      setResult(j);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const deleteHunt = async (id) => {
    if (!window.confirm('Delete this saved hunt?')) return;
    await api(`/api/admin/hunt-queries/${id}`, { method: 'DELETE' });
    loadHunts();
  };

  const rows = result?.rows || result?.sample;

  return (
    <PageShell
      kicker="Explore"
      title="Threat hunting"
      description="Query normalized telemetry (process, DNS, command line). Saved hunts mirror Falcon-style workflows (lite — no proprietary cloud analytics)."
    >
      <div className={styles.tableWrap} style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className={styles.title} style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
          Filters
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
          <input placeholder="Event type" value={filters.eventType} onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value }))} />
          <input placeholder="Hostname contains" value={filters.hostname} onChange={(e) => setFilters((f) => ({ ...f, hostname: e.target.value }))} />
          <input placeholder="Process name" value={filters.processName} onChange={(e) => setFilters((f) => ({ ...f, processName: e.target.value }))} />
          <input placeholder="Command line contains" value={filters.commandLine} onChange={(e) => setFilters((f) => ({ ...f, commandLine: e.target.value }))} />
          <input placeholder="DNS query contains" value={filters.dnsQuery} onChange={(e) => setFilters((f) => ({ ...f, dnsQuery: e.target.value }))} />
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          <input type="number" placeholder="Limit" value={filters.limit} onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value }))} />
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="falcon-btn falcon-btn-primary" onClick={runAdhoc} disabled={loading}>
            {loading ? 'Running…' : 'Run hunt'}
          </button>
          <input placeholder="Save as…" value={huntName} onChange={(e) => setHuntName(e.target.value)} style={{ minWidth: 180 }} />
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={saveHunt}>
            Save hunt
          </button>
        </div>
      </div>

      {result?.error && <div className={styles.error}>{result.error}</div>}

      {rows && (
        <div className={styles.tableWrap}>
          <p className={styles.pageSub}>
            Total matches: <strong>{result.total ?? result.result_count ?? rows.length}</strong> (showing up to limit)
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Host</th>
                <th>Type</th>
                <th>Process</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.id}>
                  <td className="mono">{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}</td>
                  <td>{ev.hostname || ev.endpoint_hostname}</td>
                  <td>{ev.event_type}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.process_name || '—'}</td>
                  <td>
                    <Link to={`/normalized-events/${ev.id}`} className={styles.viewLink}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={styles.title} style={{ fontSize: '1rem', margin: '1.5rem 0 0.5rem' }}>
        Saved hunts
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {hunts.map((h) => (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td className="mono">{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</td>
                <td>
                  <button type="button" className={styles.viewLink} style={{ marginRight: 8 }} onClick={() => runSaved(h.id)}>
                    Run
                  </button>
                  <button type="button" className={styles.deleteBtn} onClick={() => deleteHunt(h.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hunts.length === 0 && <p className={styles.pageSub}>No saved hunts. Requires hunt_queries table (schema-phase4.sql).</p>}
      </div>
    </PageShell>
  );
}
