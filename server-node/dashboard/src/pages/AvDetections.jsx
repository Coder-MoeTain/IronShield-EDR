import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AvOverview.module.css';

export default function AvDetections() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ limit: 50, severity: '', endpointId: '' });

  const fetchData = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    setLoading(true);
    api(`/api/admin/av/detections?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : (d.results || [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => fetchData(), [api, filters]);

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}><span className={styles.titleIcon}>🛡</span> Malware Detections</h1>
        <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </header>
      <div className={styles.statsBar} style={{ marginBottom: '1rem' }}>
        <select
          value={filters.severity}
          onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
          className={styles.quickLink}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Endpoint</th>
              <th>File</th>
              <th>Size</th>
              <th>SHA256</th>
              <th>Detection</th>
              <th>Family</th>
              <th>Type</th>
              <th>Signer</th>
              <th>Severity</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className={styles.empty}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={11} className={styles.empty}>No detections</td></tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td>{d.scan_time ? new Date(d.scan_time).toLocaleString() : '-'}</td>
                  <td><Link to={`/endpoints/${d.endpoint_id}`}>{d.hostname || d.endpoint_id}</Link></td>
                  <td>
                    <Link to={`/av/detections/${d.id}`} className={styles.link} title={d.file_path}>
                      {d.file_name || '-'}
                    </Link>
                  </td>
                  <td>{d.file_size != null ? `${(d.file_size / 1024).toFixed(0)} KB` : '-'}</td>
                  <td className={styles.mono} title={d.sha256}>{d.sha256 ? `${d.sha256.slice(0, 12)}…` : '-'}</td>
                  <td>{d.detection_name || '-'}</td>
                  <td>{d.family || '-'}</td>
                  <td>{d.detection_type || '-'}</td>
                  <td>{d.signer_status || '-'}</td>
                  <td><span className={`${styles.badge} ${severityClass(d.severity)}`}>{d.severity || '-'}</span></td>
                  <td>{d.score ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
