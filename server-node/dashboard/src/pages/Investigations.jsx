import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Alerts.module.css';

export default function Investigations() {
  const { api } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', limit: 50, offset: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEndpointId, setNewEndpointId] = useState('');
  const [endpoints, setEndpoints] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(filters);
    api(`/api/admin/investigations?${params}`)
      .then((r) => r.json())
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints || d || []))
      .catch(() => setEndpoints([]));
  }, []);

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

  if (loading && cases.length === 0) return <div className={styles.loading}>Loading...</div>;

  const createCase = async () => {
    if (!newTitle.trim()) return;
    await api('/api/admin/investigations', {
      method: 'POST',
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        endpoint_id: newEndpointId ? parseInt(newEndpointId) : undefined,
      }),
    });
    setShowCreate(false);
    setNewTitle('');
    setNewDesc('');
    setNewEndpointId('');
    const params = new URLSearchParams(filters);
    const r = await api(`/api/admin/investigations?${params}`);
    setCases(await r.json());
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className={styles.title}>Investigation Cases</h1>
        <button onClick={() => setShowCreate(!showCreate)}>+ New Case</button>
      </div>
      {showCreate && (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <h3>Create Investigation</h3>
          <input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <textarea placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
          <select value={newEndpointId} onChange={(e) => setNewEndpointId(e.target.value)}>
            <option value="">No endpoint</option>
            {endpoints.map((e) => (
              <option key={e.id} value={e.id}>{e.hostname}</option>
            ))}
          </select>
          <button onClick={createCase}>Create</button>
        </div>
      )}
      <div className={styles.filters}>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, offset: 0 }))}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Title</th>
              <th>Hostname</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.case_id}</td>
                <td className={styles.titleCell}>{c.title}</td>
                <td>{c.hostname ? <Link to={`/endpoints/${c.endpoint_id}`}>{c.hostname}</Link> : '-'}</td>
                <td><span className={`${styles.badge} ${severityClass(c.severity)}`}>{c.severity}</span></td>
                <td><span className={styles.status}>{c.status}</span></td>
                <td className="mono">{new Date(c.updated_at).toLocaleString()}</td>
                <td><Link to={`/investigations/${c.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {cases.length === 0 && <p className={styles.empty}>No investigation cases.</p>}
      </div>
    </div>
  );
}
