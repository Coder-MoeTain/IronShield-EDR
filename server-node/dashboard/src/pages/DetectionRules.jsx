import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './DetectionRules.module.css';

export default function DetectionRules() {
  const { api } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    api('/api/admin/detection-rules')
      .then((r) => r.json())
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleRule = async (rule) => {
    setToggling(rule.id);
    try {
      const res = await api(`/api/admin/detection-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const updated = await res.json();
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div>
      <h1 className={styles.title}>Detection Rules</h1>
      <p className={styles.subtitle}>Toggle rules to enable or disable detection.</p>
      <div className={styles.grid}>
        {rules.map((r) => (
          <div key={r.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3>{r.title}</h3>
              <span className={`${styles.badge} ${r.enabled ? styles.enabled : styles.disabled}`}>
                {r.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className={styles.severity}>{r.severity}</span>
              <button
                className={styles.toggleBtn}
                onClick={() => toggleRule(r)}
                disabled={toggling === r.id}
                title={r.enabled ? 'Disable rule' : 'Enable rule'}
              >
                {toggling === r.id ? '...' : (r.enabled ? 'Disable' : 'Enable')}
              </button>
            </div>
            <p className={styles.desc}>{r.description}</p>
            {r.mitre_technique && (
              <p className={styles.mitre}>MITRE: {r.mitre_technique}</p>
            )}
          </div>
        ))}
      </div>
      {rules.length === 0 && <p className={styles.empty}>No detection rules.</p>}
    </div>
  );
}
