import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './AvOverview.module.css';

export default function AvPolicies() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/av/policies')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : d.policies || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <PageShell
      kicker="Antivirus"
      title="Scan policies"
      description="Agent scan configuration: realtime, scheduled scans, thresholds, and limits."
    >
      <div className={styles.container}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Realtime</th>
                <th>Scheduled</th>
                <th>Execute Scan</th>
                <th>Quarantine Threshold</th>
                <th>Alert Threshold</th>
                <th>Max File Size (MB)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className={styles.empty}>Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className={styles.empty}>No policies</td></tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name || '-'}</td>
                    <td>{p.realtime_enabled ? 'Yes' : 'No'}</td>
                    <td>{p.scheduled_enabled ? 'Yes' : 'No'}</td>
                    <td>{p.execute_scan_enabled ? 'Yes' : 'No'}</td>
                    <td>{p.quarantine_threshold ?? '-'}</td>
                    <td>{p.alert_threshold ?? '-'}</td>
                    <td>{p.max_file_size_mb ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
