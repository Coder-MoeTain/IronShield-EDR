import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './DetectionRuleDetail.module.css';

export default function DetectionRuleDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api(`/api/admin/detection-rules/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setRule)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageShell loading loadingLabel="Loading rule…" />;
  if (err || !rule) {
    return (
      <PageShell kicker="Detection" title="Rule not found" description={err || 'Invalid id'}>
        <Link to="/detection-rules" className="falcon-btn falcon-btn-ghost">
          ← Rules
        </Link>
      </PageShell>
    );
  }

  const condJson = JSON.stringify(rule.conditions || {}, null, 2);

  return (
    <PageShell
      kicker="Detection"
      title={rule.title}
      description={rule.description || 'Custom IOA rule'}
      actions={
        <>
          <Link to="/detection-rules" className="falcon-btn falcon-btn-ghost">
            ← All rules
          </Link>
          <Link to={`/detection-rules/${rule.id}/edit`} className="falcon-btn">
            Edit rule
          </Link>
        </>
      }
    >
      <div className={styles.meta}>
        <div>
          <span className={styles.label}>Rule ID</span>
          <span className={`mono ${styles.mono}`}>{rule.name}</span>
        </div>
        <div>
          <span className={styles.label}>Severity</span>
          <span className={falconSeverityClass(rule.severity)}>{rule.severity}</span>
        </div>
        <div>
          <span className={styles.label}>Status</span>
          <span className={rule.enabled ? styles.on : styles.off}>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div>
          <span className={styles.label}>Updated</span>
          <span>{rule.updated_at ? new Date(rule.updated_at).toLocaleString() : '—'}</span>
        </div>
      </div>

      {(rule.mitre_tactic || rule.mitre_technique) && (
        <div className={styles.mitre}>
          <strong>MITRE ATT&amp;CK</strong>
          {rule.mitre_tactic && <div>Tactic: {rule.mitre_tactic}</div>}
          {rule.mitre_technique && <div>Technique: {rule.mitre_technique}</div>}
        </div>
      )}

      <section className={styles.section}>
        <h3 className={styles.h3}>Conditions (logic)</h3>
        <p className={styles.hint}>
          All keys must match (AND). Keys are evaluated by the detection engine on normalized events.
        </p>
        <pre className={styles.pre}>{condJson}</pre>
      </section>
    </PageShell>
  );
}
