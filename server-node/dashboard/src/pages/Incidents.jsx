import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Incidents.module.css';

function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function Incidents() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', limit: 50, offset: 0 });

  const fetchData = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined) params.set(k, v);
    });
    setLoading(true);
    api(`/api/admin/incidents?${params}`)
      .then((r) => r.json())
      .then(setIncidents)
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

  const statusClass = (s) => {
    if (s === 'open') return styles.statusOpen;
    if (s === 'investigating') return styles.statusInvestigating;
    if (s === 'resolved') return styles.statusResolved;
    return styles.statusClosed;
  };

  const updateStatus = async (id, status) => {
    await api(`/api/admin/incidents/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  if (loading && incidents.length === 0) return <div className={styles.loading}>Loading incidents...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>🔥</span> Incidents
        </h1>
        <button onClick={fetchData} className={styles.refreshBtn}>↻ Refresh</button>
      </div>

      <div className={styles.filters}>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, offset: 0 }))}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value, offset: 0 }))}
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
              <th>ID</th>
              <th>Time</th>
              <th>Title</th>
              <th>Endpoint</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Correlation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => (
              <tr
                key={inc.id}
                className={styles.row}
                onClick={() => navigate(`/incidents/${inc.id}`)}
              >
                <td className={styles.mono}>{inc.incident_id}</td>
                <td className={styles.timeCell}>
                  <span>{timeAgo(inc.updated_at)}</span>
                  <span className={styles.timeFull}>{new Date(inc.updated_at).toLocaleString()}</span>
                </td>
                <td className={styles.titleCell}>{inc.title}</td>
                <td>
                  {inc.endpoint_id ? (
                    <Link to={`/endpoints/${inc.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
                      {inc.hostname || `Endpoint ${inc.endpoint_id}`}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <span className={`${styles.badge} ${severityClass(inc.severity)}`}>{inc.severity}</span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${statusClass(inc.status)}`}>{inc.status}</span>
                </td>
                <td className={styles.mono}>{inc.correlation_type || '-'}</td>
                <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                  {inc.status === 'open' && (
                    <button className={styles.quickBtn} onClick={() => updateStatus(inc.id, 'investigating')}>
                      Investigate
                    </button>
                  )}
                  {inc.status !== 'closed' && (
                    <button className={styles.quickBtn} onClick={() => updateStatus(inc.id, 'closed')}>
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && <div className={styles.empty}>No incidents found.</div>}
      </div>
    </div>
  );
}
