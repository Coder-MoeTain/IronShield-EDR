import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './IOCs.module.css';

export default function IOCs() {
  const { api } = useAuth();
  const [iocs, setIocs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('hash');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState('medium');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api('/api/admin/iocs').then((r) => r.json()),
      api('/api/admin/iocs/matches').then((r) => r.json()),
    ])
      .then(([i, m]) => {
        setIocs(i || []);
        setMatches(m || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addIoc = async () => {
    if (!newValue.trim()) return;
    await api('/api/admin/iocs', {
      method: 'POST',
      body: JSON.stringify({
        ioc_type: newType,
        ioc_value: newValue.trim(),
        description: newDesc.trim() || undefined,
        severity: newSeverity,
      }),
    });
    setShowAdd(false);
    setNewValue('');
    setNewDesc('');
    fetchData();
  };

  const deleteIoc = async (id) => {
    if (!confirm('Delete this IOC?')) return;
    await api(`/api/admin/iocs/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

  if (loading && iocs.length === 0) return <div className={styles.loading}>Loading IOCs...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>🎯</span> IOC Watchlist
        </h1>
        <button onClick={() => setShowAdd(!showAdd)} className={styles.addBtn}>+ Add IOC</button>
      </div>

      {showAdd && (
        <div className={styles.addCard}>
          <h3>Add Indicator</h3>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="hash">Hash (SHA256)</option>
            <option value="ip">IP</option>
            <option value="domain">Domain</option>
            <option value="path">Path</option>
            <option value="url">URL</option>
          </select>
          <input
            placeholder={newType === 'hash' ? 'SHA256 hash' : `Value`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button onClick={addIoc}>Add</button>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2>Watchlist ({iocs.length})</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Severity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {iocs.map((i) => (
                  <tr key={i.id}>
                    <td className={styles.mono}>{i.ioc_type}</td>
                    <td className={styles.valueCell} title={i.ioc_value}>{i.ioc_value?.slice(0, 40)}{(i.ioc_value?.length || 0) > 40 ? '…' : ''}</td>
                    <td><span className={`${styles.badge} ${severityClass(i.severity)}`}>{i.severity}</span></td>
                    <td>
                      <button onClick={() => deleteIoc(i.id)} className={styles.delBtn}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {iocs.length === 0 && <div className={styles.empty}>No IOCs. Add hash, IP, or domain indicators.</div>}
          </div>
        </div>

        <div className={styles.panel}>
          <h2>Recent Matches ({matches.length})</h2>
          <div className={styles.tableWrap}>
            {matches.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>IOC</th>
                    <th>Type</th>
                    <th>Event ID</th>
                    <th>Endpoint</th>
                    <th>Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.slice(0, 20).map((m) => (
                    <tr key={m.id}>
                      <td className={styles.mono}>{m.ioc_value?.slice(0, 16)}…</td>
                      <td>{m.ioc_type}</td>
                      <td className={styles.mono}>{m.event_id}</td>
                      <td>
                        {m.endpoint_id ? (
                          <Link to={`/endpoints/${m.endpoint_id}`}>{m.hostname || `Endpoint ${m.endpoint_id}`}</Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{m.matched_at ? new Date(m.matched_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>No IOC matches yet. Hash matching runs during event ingestion.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
