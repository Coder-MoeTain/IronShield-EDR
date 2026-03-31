import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './DetectionRuleEditor.module.css';

const ALLOWED_KEYS = [
  'event_type',
  'process_name',
  'parent_process',
  'child_process',
  'encoded_command',
  'suspicious_params',
  'path_contains',
  'unusual_parent',
  'signed',
  'dns_query_contains',
  'dns_query_length_gt',
  'registry_key_contains',
  'image_loaded_contains',
  'command_line_entropy_gt',
  'suspicious_indicator_count_gte',
  'collector_confidence_lt',
];

const TEMPLATE = `{
  "event_type": "process_create",
  "process_name": "powershell.exe",
  "encoded_command": true
}`;

export default function DetectionRuleEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { api } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [mitreTactic, setMitreTactic] = useState('');
  const [mitreTechnique, setMitreTechnique] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [conditionsText, setConditionsText] = useState(TEMPLATE);

  const load = useCallback(() => {
    if (isNew) return;
    setLoading(true);
    api(`/api/admin/detection-rules/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rule) => {
        setName(rule.name || '');
        setTitle(rule.title || '');
        setDescription(rule.description || '');
        setSeverity(rule.severity || 'medium');
        setMitreTactic(rule.mitre_tactic || '');
        setMitreTechnique(rule.mitre_technique || '');
        setEnabled(!!rule.enabled);
        setConditionsText(JSON.stringify(rule.conditions || {}, null, 2));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [api, id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    let conditions;
    try {
      conditions = JSON.parse(conditionsText);
    } catch {
      setErr('Conditions must be valid JSON');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        description: description || null,
        severity,
        mitre_tactic: mitreTactic || null,
        mitre_technique: mitreTechnique || null,
        enabled,
        conditions,
      };
      if (isNew) body.name = name.trim();

      const url = isNew ? '/api/admin/detection-rules' : `/api/admin/detection-rules/${id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      navigate(`/detection-rules/${data.id}`);
    } catch (ex) {
      setErr(ex.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageShell loading loadingLabel="Loading…" />;

  return (
    <PageShell
      kicker="Detection"
      title={isNew ? 'New custom IOA rule' : 'Edit rule'}
      description="Use snake_case rule ID (letters, digits, underscore). Conditions are ANDed; see engine docs for supported keys."
      actions={
        <Link to={isNew ? '/detection-rules' : `/detection-rules/${id}`} className="falcon-btn falcon-btn-ghost">
          Cancel
        </Link>
      }
    >
      <form className={styles.form} onSubmit={save}>
        {err && <div className={styles.error}>{err}</div>}

        {isNew && (
          <label className={styles.field}>
            Rule ID (name)
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_custom_rule"
              required
              pattern="[a-z][a-z0-9_]{1,120}"
              title="snake_case: letter, then lowercase letters, digits, underscore"
            />
          </label>
        )}

        <label className={styles.field}>
          Title
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className={styles.field}>
          Description
          <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            Severity
            <select className={styles.input} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            MITRE tactic (optional)
            <input className={styles.input} value={mitreTactic} onChange={(e) => setMitreTactic(e.target.value)} placeholder="TA0002" />
          </label>
          <label className={styles.field}>
            MITRE technique (optional)
            <input
              className={styles.input}
              value={mitreTechnique}
              onChange={(e) => setMitreTechnique(e.target.value)}
              placeholder="T1059.001"
            />
          </label>
        </div>

        <div className={styles.field}>
          <div className={styles.condHead}>
            <span>Conditions (JSON)</span>
            <button type="button" className="falcon-btn falcon-btn-ghost" onClick={() => setConditionsText(TEMPLATE)}>
              Insert template
            </button>
          </div>
          <textarea
            className={styles.code}
            value={conditionsText}
            onChange={(e) => setConditionsText(e.target.value)}
            rows={14}
            spellCheck={false}
            required
          />
          <p className={styles.keys}>
            Allowed keys: <code>{ALLOWED_KEYS.join(', ')}</code>
          </p>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="falcon-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save rule'}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
