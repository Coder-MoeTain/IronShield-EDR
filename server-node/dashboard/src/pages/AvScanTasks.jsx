import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AvOverview.module.css';

export default function AvScanTasks() {
  const { api } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [endpointId, setEndpointId] = useState('');
  const [targetPath, setTargetPath] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api('/api/admin/av/scan-tasks'),
      api('/api/admin/endpoints'),
    ])
      .then(async ([tRes, eRes]) => {
        const tData = await tRes.json();
        const eData = await eRes.json();
        setTasks(Array.isArray(tData) ? tData : (tData.tasks || []));
        setEndpoints(eData.endpoints || eData || []);
      })
      .catch(() => { setTasks([]); setEndpoints([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => fetchData(), [api]);

  const createTask = async () => {
    if (!endpointId) { alert('Select an endpoint'); return; }
    setCreating(true);
    try {
      await api('/api/admin/av/scan-task', {
        method: 'POST',
        body: JSON.stringify({ endpointId: parseInt(endpointId), target_path: targetPath || null }),
      });
      setEndpointId('');
      setTargetPath('');
      fetchData();
    } catch (e) {
      alert(e.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const statusClass = (s) => {
    if (s === 'completed') return styles.low;
    if (s === 'failed') return styles.critical;
    if (s === 'in_progress') return styles.statBlue;
    return styles.medium;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}><span className={styles.titleIcon}>🛡</span> Scan Tasks</h1>
        <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </header>

      <div className={styles.section} style={{ marginBottom: '1rem' }}>
        <div className={styles.sectionHeader}>
          <h2>Create Scan Task</h2>
        </div>
        <div style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label>
            Endpoint
            <select value={endpointId} onChange={(e) => setEndpointId(e.target.value)} className={styles.quickLink} style={{ marginLeft: 8 }}>
              <option value="">Select…</option>
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>{e.hostname || e.id}</option>
              ))}
            </select>
          </label>
          <label>
            Target path (optional)
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="C:\Users\..."
              className={styles.quickLink}
              style={{ marginLeft: 8, minWidth: 200 }}
            />
          </label>
          <button className={styles.quickLink} onClick={createTask} disabled={creating}>
            {creating ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Endpoint</th>
              <th>Type</th>
              <th>Target</th>
              <th>Status</th>
              <th>Files</th>
              <th>Detections</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className={styles.empty}>Loading…</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No scan tasks</td></tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.hostname || t.endpoint_id}</td>
                  <td>{t.task_type || '-'}</td>
                  <td className={styles.mono} title={t.target_path}>{t.target_path ? t.target_path.slice(-40) : '-'}</td>
                  <td><span className={`${styles.badge} ${statusClass(t.status)}`}>{t.status || '-'}</span></td>
                  <td>{t.files_scanned ?? '-'}</td>
                  <td>{t.detections_found ?? '-'}</td>
                  <td>{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
