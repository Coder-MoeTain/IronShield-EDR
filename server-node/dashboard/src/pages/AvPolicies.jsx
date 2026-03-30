import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './AvOverview.module.css';

const emptyForm = {
  name: '',
  realtime_enabled: true,
  scheduled_enabled: true,
  execute_scan_enabled: true,
  quarantine_threshold: 70,
  alert_threshold: 50,
  max_file_size_mb: 100,
  realtime_debounce_seconds: 2,
  device_control_enabled: false,
  web_url_protection_enabled: true,
  removable_storage_action: 'audit',
  ransomware_protection_enabled: true,
  include_paths_text: '',
  exclude_paths_text: '',
  exclude_extensions_text: '.log,.tmp,.cache',
};

function linesToArr(s) {
  return String(s || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function arrToLines(a) {
  return Array.isArray(a) ? a.join('\n') : '';
}

export default function AvPolicies() {
  const { api, hasPermission } = useAuth();
  const canWrite = hasPermission('actions:write');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);

  const loadList = useCallback(() => {
    setLoading(true);
    api('/api/admin/av/policies')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : d.policies || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openEdit = async (id) => {
    setLoadErr(null);
    setSaveMsg(null);
    setEditingId(id);
    try {
      const r = await api(`/api/admin/av/policies/${id}`);
      if (!r.ok) {
        setLoadErr(r.status === 404 ? 'Policy not found' : 'Failed to load policy');
        return;
      }
      const p = await r.json();
      setForm({
        name: p.name || '',
        realtime_enabled: !!p.realtime_enabled,
        scheduled_enabled: !!p.scheduled_enabled,
        execute_scan_enabled: p.execute_scan_enabled !== false,
        quarantine_threshold: p.quarantine_threshold ?? 70,
        alert_threshold: p.alert_threshold ?? 50,
        max_file_size_mb: p.max_file_size_mb ?? 100,
        realtime_debounce_seconds: p.realtime_debounce_seconds ?? 2,
        device_control_enabled: !!p.device_control_enabled,
        web_url_protection_enabled: p.web_url_protection_enabled !== false,
        removable_storage_action: p.removable_storage_action || 'audit',
        ransomware_protection_enabled: p.ransomware_protection_enabled !== false,
        include_paths_text: arrToLines(p.include_paths),
        exclude_paths_text: arrToLines(p.exclude_paths),
        exclude_extensions_text: Array.isArray(p.exclude_extensions) ? p.exclude_extensions.join(',') : '',
      });
    } catch {
      setLoadErr('Failed to load policy');
    }
  };

  const closeModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLoadErr(null);
    setSaveMsg(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (editingId == null) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = {
        name: form.name,
        realtime_enabled: form.realtime_enabled,
        scheduled_enabled: form.scheduled_enabled,
        execute_scan_enabled: form.execute_scan_enabled,
        quarantine_threshold: Number(form.quarantine_threshold),
        alert_threshold: Number(form.alert_threshold),
        max_file_size_mb: Number(form.max_file_size_mb),
        realtime_debounce_seconds: Number(form.realtime_debounce_seconds),
        device_control_enabled: form.device_control_enabled,
        web_url_protection_enabled: form.web_url_protection_enabled,
        removable_storage_action: form.removable_storage_action,
        ransomware_protection_enabled: form.ransomware_protection_enabled,
        include_paths: linesToArr(form.include_paths_text),
        exclude_paths: linesToArr(form.exclude_paths_text),
        exclude_extensions: form.exclude_extensions_text
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      };
      const r = await api(`/api/admin/av/policies/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setSaveMsg({ err: err.error || 'Save failed' });
        return;
      }
      setSaveMsg({ ok: 'Policy saved.' });
      loadList();
      setTimeout(closeModal, 600);
    } catch (ex) {
      setSaveMsg({ err: ex.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      kicker="Antivirus"
      title="Scan policies"
      description="Configure realtime and scheduled scanning, thresholds, USB/removable control, web URL protection, and ransomware classification for agents."
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
                <th>Device control</th>
                <th>Removable USB</th>
                <th>Ransomware</th>
                <th>Web URL</th>
                {hasPermission('actions:write') && <th />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className={styles.empty}>Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={13} className={styles.empty}>No policies</td></tr>
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
                    <td>{p.device_control_enabled ? 'On' : 'Off'}</td>
                    <td className="mono data-mono">{p.removable_storage_action || 'audit'}</td>
                    <td>{p.ransomware_protection_enabled !== false ? 'On' : 'Off'}</td>
                    <td>{p.web_url_protection_enabled !== false ? 'On' : 'Off'}</td>
                    {canWrite && (
                      <td>
                        <button
                          type="button"
                          className={styles.refreshBtn}
                          onClick={() => openEdit(p.id)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingId != null && (
        <div className={styles.modalOverlay} role="presentation" onClick={closeModal}>
          <div
            className={styles.modal}
            style={{ maxWidth: '520px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="av-policy-edit-title"
          >
            <h3 id="av-policy-edit-title">Edit policy #{editingId}</h3>
            <p className={styles.modalHint}>
              Changes apply to endpoints using this AV scan policy. Agents poll policy and adjust behavior on their next cycle.
            </p>
            {loadErr && <p className={styles.msgErr}>{loadErr}</p>}
            {!loadErr && (
              <form onSubmit={save} className={styles.modalForm}>
                <label>
                  Name
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.realtime_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, realtime_enabled: e.target.checked }))}
                  />
                  Realtime scanning (watch include paths)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.scheduled_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_enabled: e.target.checked }))}
                  />
                  Scheduled scans enabled
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.execute_scan_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, execute_scan_enabled: e.target.checked }))}
                  />
                  Execute scan on demand
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.ransomware_protection_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, ransomware_protection_enabled: e.target.checked }))}
                  />
                  Ransomware protection (known signatures + behavioral classification; alerts in Malware alerts)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.device_control_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, device_control_enabled: e.target.checked }))}
                  />
                  USB / removable device control (Windows agent)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={form.web_url_protection_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, web_url_protection_enabled: e.target.checked }))}
                  />
                  Web URL protection
                </label>
                <label>
                  Removable storage action
                  <select
                    className={styles.select}
                    value={form.removable_storage_action}
                    onChange={(e) => setForm((f) => ({ ...f, removable_storage_action: e.target.value }))}
                  >
                    <option value="audit">audit</option>
                    <option value="block">block</option>
                    <option value="allow">allow</option>
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label>
                    Alert threshold
                    <input
                      type="number"
                      className={styles.input}
                      min={0}
                      max={100}
                      value={form.alert_threshold}
                      onChange={(e) => setForm((f) => ({ ...f, alert_threshold: e.target.value }))}
                    />
                  </label>
                  <label>
                    Quarantine threshold
                    <input
                      type="number"
                      className={styles.input}
                      min={0}
                      max={100}
                      value={form.quarantine_threshold}
                      onChange={(e) => setForm((f) => ({ ...f, quarantine_threshold: e.target.value }))}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label>
                    Max file size (MB)
                    <input
                      type="number"
                      className={styles.input}
                      min={1}
                      value={form.max_file_size_mb}
                      onChange={(e) => setForm((f) => ({ ...f, max_file_size_mb: e.target.value }))}
                    />
                  </label>
                  <label>
                    Realtime debounce (seconds)
                    <input
                      type="number"
                      className={styles.input}
                      min={1}
                      max={60}
                      value={form.realtime_debounce_seconds}
                      onChange={(e) => setForm((f) => ({ ...f, realtime_debounce_seconds: e.target.value }))}
                    />
                  </label>
                </div>
                <label>
                  Include paths (one per line, Windows paths)
                  <textarea
                    className={styles.input}
                    rows={4}
                    value={form.include_paths_text}
                    onChange={(e) => setForm((f) => ({ ...f, include_paths_text: e.target.value }))}
                  />
                </label>
                <label>
                  Exclude paths (one per line)
                  <textarea
                    className={styles.input}
                    rows={3}
                    value={form.exclude_paths_text}
                    onChange={(e) => setForm((f) => ({ ...f, exclude_paths_text: e.target.value }))}
                  />
                </label>
                <label>
                  Exclude extensions (comma-separated)
                  <input
                    className={styles.input}
                    value={form.exclude_extensions_text}
                    onChange={(e) => setForm((f) => ({ ...f, exclude_extensions_text: e.target.value }))}
                  />
                </label>
                {saveMsg?.ok && <p className={styles.msgOk}>{saveMsg.ok}</p>}
                {saveMsg?.err && <p className={styles.msgErr}>{saveMsg.err}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.refreshBtn} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
