import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Endpoints.module.css';

export default function Endpoints() {
  const { api } = useAuth();
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchEndpoints = () => {
    api('/api/admin/endpoints')
      .then((r) => r.json())
      .then(setEndpoints)
      .catch(() => setEndpoints([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchEndpoints();
  }, [api]);

  const handleDelete = async (ep) => {
    if (!confirm(`Delete endpoint "${ep.hostname}"? This will remove all associated data.`)) return;
    setDeleting(ep.id);
    try {
      const res = await api(`/api/admin/endpoints/${ep.id}`, { method: 'DELETE' });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(errBody.error || `Delete failed (${res.status})`);
      }
      fetchEndpoints();
    } catch (e) {
      alert(e.message || 'Failed to delete endpoint');
    } finally {
      setDeleting(null);
    }
  };

  const statusClass = (s) => {
    if (s === 'online') return styles.statusOnline;
    if (s === 'offline') return styles.statusOffline;
    return styles.statusUnknown;
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div>
      <h1 className={styles.title}>Endpoints</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>IP</th>
              <th>User</th>
              <th>OS</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Disk</th>
              <th>Status</th>
              <th>Last Heartbeat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id}>
                <td className={styles.hostname}>{ep.hostname}</td>
                <td className="mono">{ep.ip_address || '-'}</td>
                <td>{ep.logged_in_user || '-'}</td>
                <td className={styles.os}>{ep.os_version ? ep.os_version.substring(0, 40) + '...' : '-'}</td>
                <td>{ep.cpu_percent != null ? `${ep.cpu_percent}%` : '-'}</td>
                <td>{ep.ram_percent != null ? `${ep.ram_percent}%` : '-'}</td>
                <td>{ep.disk_percent != null ? `${ep.disk_percent}%` : '-'}</td>
                <td>
                  <span className={`${styles.badge} ${statusClass(ep.status)}`}>
                    {ep.status || 'unknown'}
                  </span>
                </td>
                <td className="mono">
                  {ep.last_heartbeat_at
                    ? new Date(ep.last_heartbeat_at).toLocaleString()
                    : '-'}
                </td>
                <td>
                  <Link to={`/endpoints/${ep.id}`} className={styles.viewLink}>View</Link>
                  {' '}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(ep)}
                    disabled={deleting === ep.id}
                    title="Delete endpoint"
                  >
                    {deleting === ep.id ? '…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {endpoints.length === 0 && (
          <p className={styles.empty}>No endpoints registered yet.</p>
        )}
      </div>
    </div>
  );
}
