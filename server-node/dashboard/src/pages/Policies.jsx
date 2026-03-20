import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Alerts.module.css';

export default function Policies() {
  const { api } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/policies')
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div>
      <h1 className={styles.title}>Endpoint Policies</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mode</th>
              <th>Telemetry (s)</th>
              <th>Batch Size</th>
              <th>Heartbeat (min)</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td className={styles.titleCell}>{p.name}</td>
                <td><span className={styles.badge}>{p.mode}</span></td>
                <td>{p.telemetry_interval_seconds}</td>
                <td>{p.batch_upload_size}</td>
                <td>{p.heartbeat_interval_minutes}</td>
                <td>{p.is_default ? 'Yes' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {policies.length === 0 && <p className={styles.empty}>No policies. Run schema-phase3.sql.</p>}
      </div>
    </div>
  );
}
