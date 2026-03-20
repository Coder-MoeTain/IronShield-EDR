import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './AvOverview.module.css';

export default function AvSignatures() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/av/signatures')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : d.signatures || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [api]);

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}><span className={styles.titleIcon}>🛡</span> Signatures</h1>
      </header>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>UUID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Hash</th>
              <th>Family</th>
              <th>Severity</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className={styles.empty}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No signatures</td></tr>
            ) : (
              items.map((s) => (
                <tr key={s.id || s.signature_uuid}>
                  <td className={styles.mono}>{s.signature_uuid ? `${s.signature_uuid.slice(0, 12)}…` : '-'}</td>
                  <td>{s.name || '-'}</td>
                  <td>{s.signature_type || '-'}</td>
                  <td className={styles.mono} title={s.hash_value}>{s.hash_value ? `${s.hash_value.slice(0, 16)}…` : '-'}</td>
                  <td>{s.family || '-'}</td>
                  <td><span className={`${styles.badge} ${severityClass(s.severity)}`}>{s.severity || '-'}</span></td>
                  <td>{s.enabled ? 'Yes' : 'No'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
