import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Alerts.module.css';

export default function Triage() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    api('/api/admin/triage?limit=50')
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const viewResult = async (id) => {
    const r = await api(`/api/admin/triage/${id}`);
    const data = await r.json();
    setSelected(id);
    setResults(data.results || []);
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div>
      <h1 className={styles.title}>Triage Requests</h1>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Endpoint</th>
              <th>Type</th>
              <th>Status</th>
              <th>Requested</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.id}</td>
                <td><Link to={`/endpoints/${t.endpoint_id}`}>{t.hostname}</Link></td>
                <td>{t.request_type}</td>
                <td><span className={styles.status}>{t.status}</span></td>
                <td className="mono">{new Date(t.created_at).toLocaleString()}</td>
                <td>
                  <button className={styles.link} onClick={() => viewResult(t.id)}>View Result</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className={styles.empty}>No triage requests.</p>}
      </div>
      {selected && results && results.length > 0 && (
        <div className={styles.card} style={{ marginTop: 16 }}>
          <h3>Triage Result</h3>
          <pre style={{ maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
            {JSON.stringify(
              typeof results[0]?.result_json === 'string'
                ? JSON.parse(results[0].result_json)
                : results[0]?.result_json || results[0],
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
