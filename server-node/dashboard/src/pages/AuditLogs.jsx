import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AuditLogs.module.css';

export default function AuditLogs() {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/audit-logs')
      .then((r) => r.json())
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div>
      <h1 className={styles.title}>Audit Logs</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="mono">{new Date(l.created_at).toLocaleString()}</td>
                <td>{l.username || '-'}</td>
                <td>{l.action}</td>
                <td>{l.resource_type || '-'}</td>
                <td className="mono">{l.ip_address || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className={styles.empty}>No audit logs.</p>}
      </div>
    </div>
  );
}
