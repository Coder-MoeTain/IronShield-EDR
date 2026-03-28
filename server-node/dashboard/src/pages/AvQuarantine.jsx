import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import PageShell from '../components/PageShell';
import PermissionGate from '../components/PermissionGate';
import styles from './AvOverview.module.css';

export default function AvQuarantine() {
  const { api } = useAuth();
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    api('/api/admin/av/quarantine')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : (d.items || [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => fetchData(), [api]);

  const handleRestore = async (id) => {
    if (
      !(await confirm({
        title: 'Restore from quarantine',
        message: 'Restore this file to its original location on the endpoint?',
        confirmLabel: 'Restore',
      }))
    )
      return;
    try {
      await api(`/api/admin/av/quarantine/${id}/restore`, { method: 'POST' });
      fetchData();
    } catch (e) {
      addToast({ variant: 'error', message: e.message || 'Restore failed' });
    }
  };

  const handleDelete = async (id) => {
    if (
      !(await confirm({
        title: 'Delete quarantined file',
        message: 'Permanently delete this quarantined file? This cannot be undone.',
        danger: true,
        confirmLabel: 'Delete',
      }))
    )
      return;
    try {
      await api(`/api/admin/av/quarantine/${id}/delete`, { method: 'POST' });
      fetchData();
    } catch (e) {
      addToast({ variant: 'error', message: e.message || 'Delete failed' });
    }
  };

  return (
    <PageShell
      kicker="Antivirus"
      title="Quarantine"
      description="Files isolated on endpoints after malicious or suspicious verdicts."
    >
      <div className={styles.container}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Original Path</th>
                <th>SHA256</th>
                <th>Detection</th>
                <th>Endpoint</th>
                <th>Quarantined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className={styles.empty}>Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className={styles.empty}>No quarantined items</td></tr>
              ) : (
                items.map((q) => (
                  <tr key={q.id}>
                    <td className={styles.mono} title={q.original_path}>{q.original_path ? q.original_path.slice(-60) : '-'}</td>
                    <td className={styles.mono} title={q.sha256}>{q.sha256 ? `${q.sha256.slice(0, 12)}…` : '-'}</td>
                    <td>{q.detection_name || '-'}</td>
                    <td>{q.hostname || q.endpoint_id}</td>
                    <td>{q.created_at ? new Date(q.created_at).toLocaleString() : '-'}</td>
                    <td><span className={styles.badge}>{q.status || 'quarantined'}</span></td>
                    <td>
                      {q.status === 'quarantined' && (
                        <PermissionGate permission="actions:write">
                          <>
                            <button type="button" className={styles.quickLink} style={{ marginRight: 8 }} onClick={() => handleRestore(q.id)}>Restore</button>
                            <button type="button" className={styles.quickLink} onClick={() => handleDelete(q.id)}>Delete</button>
                          </>
                        </PermissionGate>
                      )}
                    </td>
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
