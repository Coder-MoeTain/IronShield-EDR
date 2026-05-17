import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { apiPath } from '../../../utils/apiPath';
import styles from './EndpointSoftwareTab.module.css';

export default function EndpointSoftwareTab() {
  const { id } = useParams();
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(apiPath(`/api/software/inventory?endpoint_id=${id}&limit=500`))
      .then((r) => (r.ok ? r.json() : { inventory: [] }))
      .then((d) => setRows(d.inventory || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [api, id]);

  const vulnerable = rows.filter((r) => (r.risk_score || 0) >= 61).length;
  const blocked = rows.filter((r) => r.blocked).length;

  return (
    <div className={styles.wrap}>
      <motion.div className={styles.kpis}>
        <span>Installed: <strong>{rows.length}</strong></span>
        <span>Vulnerable: <strong>{vulnerable}</strong></span>
        <span>Blocked: <strong>{blocked}</strong></span>
      </motion.div>
      {loading ? <p>Loading software inventory…</p> : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Software</th>
              <th>Version</th>
              <th>Risk</th>
              <th>Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.version || '—'}</td>
                <td>{r.risk_score ?? 0}</td>
                <td>{r.risk_level || 'none'}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </motion.div>
  );
}
