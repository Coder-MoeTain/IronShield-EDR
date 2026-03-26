import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import { falconSeverityClass } from '../utils/falconUi';
import { asJsonList } from '../utils/apiJson';
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
      .then((r) => asJsonList(r))
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => asJsonList(r))
      .then(setEndpoints)
      .catch(() => setEndpoints([]));
  }, []);

  if (loading && cases.length === 0) return <PageShell loading loadingLabel="Loading investigations…" />;

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
    setCases(await asJsonList(r));
  };

  return (
    <PageShell
      kicker="Respond"
      title="Investigation cases"
      description="SOC cases linked to endpoints and alerts — track status from open to closed."
      actions={
        <button type="button" className="falcon-btn falcon-btn-primary" onClick={() => setShowCreate(!showCreate)}>
          + New case
        </button>
      }
    >
    <div>
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
      <FalconTableShell
        toolbar={(
          <div className={`${styles.filters} falcon-filter-bar`}>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, offset: 0 }))}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        )}
        footer={(
          <FalconPagination
            offset={filters.offset}
            limit={filters.limit}
            pageItemCount={cases.length}
            onPrev={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
            onNext={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
            onLimitChange={(newLimit) => setFilters((f) => ({ ...f, limit: newLimit, offset: 0 }))}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      >
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
                  <td><span className={falconSeverityClass(c.severity)}>{c.severity}</span></td>
                  <td><span className={styles.status}>{c.status}</span></td>
                  <td className="mono">{new Date(c.updated_at).toLocaleString()}</td>
                  <td><Link to={`/investigations/${c.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {cases.length === 0 && (
            <FalconEmptyState
              title="No investigation cases"
              description="Create a case from an alert or use + New case. Cases track status from open through closed."
            />
          )}
        </div>
      </FalconTableShell>
    </div>
    </PageShell>
  );
}
