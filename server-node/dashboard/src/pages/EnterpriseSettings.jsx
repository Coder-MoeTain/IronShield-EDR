import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './EnterpriseSettings.module.css';

const TABS = [
  { id: 'notifications', label: 'Notification Channels', icon: '🔔' },
  { id: 'retention', label: 'Retention Policies', icon: '📦' },
  { id: 'agent-releases', label: 'Agent Releases', icon: '🚀' },
];

const RETENTION_TABLES = [
  { value: 'raw_events', label: 'Raw Events' },
  { value: 'normalized_events', label: 'Normalized Events' },
  { value: 'endpoint_heartbeats', label: 'Endpoint Heartbeats' },
  { value: 'audit_logs', label: 'Audit Logs' },
];

export default function EnterpriseSettings() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('notifications');
  const [channels, setChannels] = useState([]);
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [agentReleases, setAgentReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', isError: false });
  const [modal, setModal] = useState(null);

  const fetchChannels = () =>
    api('/api/admin/notification-channels').then((r) => r.json()).then(setChannels).catch(() => setChannels([]));
  const fetchRetention = () =>
    api('/api/admin/retention-policies').then((r) => r.json()).then(setRetentionPolicies).catch(() => setRetentionPolicies([]));
  const fetchReleases = () =>
    api('/api/admin/agent-releases').then((r) => r.json()).then(setAgentReleases).catch(() => setAgentReleases([]));

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChannels(), fetchRetention(), fetchReleases()]).finally(() => setLoading(false));
  }, [activeTab]);

  const runRetention = async () => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api('/api/admin/retention-policies/run', { method: 'POST' });
      const d = await r.json();
      setMsg({ text: `Retention run complete. Deleted: ${d.deleted ?? 0} records.`, isError: false });
      fetchRetention();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const createChannel = async (type, name, config) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api('/api/admin/notification-channels', {
        method: 'POST',
        body: JSON.stringify({ type, name, config }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg({ text: 'Channel created', isError: false });
      setModal(null);
      fetchChannels();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const createRetentionPolicy = async (name, table_name, retain_days) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api('/api/admin/retention-policies', {
        method: 'POST',
        body: JSON.stringify({ name, table_name, retain_days: parseInt(retain_days) || 90 }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg({ text: 'Policy created', isError: false });
      setModal(null);
      fetchRetention();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const createAgentRelease = async (version, download_url, checksum_sha256, release_notes, is_current) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api('/api/admin/agent-releases', {
        method: 'POST',
        body: JSON.stringify({ version, download_url, checksum_sha256, release_notes, is_current: !!is_current }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg({ text: 'Release created', isError: false });
      setModal(null);
      fetchReleases();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  if (loading && channels.length === 0 && retentionPolicies.length === 0 && agentReleases.length === 0) {
    return <PageShell loading loadingLabel="Loading enterprise settings…" />;
  }

  return (
    <PageShell
      kicker="Enterprise"
      title="Enterprise settings"
      description="Notification channels, data retention, and agent release artifacts for managed tenants."
    >
    <div className={styles.container}>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {msg.text && <div className={`${styles.msg} ${msg.isError ? styles.msgError : ''}`}>{msg.text}</div>}

      {activeTab === 'notifications' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Notification Channels</h2>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setModal({ type: 'channel' })}
            >
              + Add Channel
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Active</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.id}>
                    <td><span className={styles.badge}>{c.type}</span></td>
                    <td>{c.name || '-'}</td>
                    <td>{c.is_active ? 'Yes' : 'No'}</td>
                    <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {channels.length === 0 && <div className={styles.empty}>No notification channels configured.</div>}
          </div>
        </section>
      )}

      {activeTab === 'retention' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Retention Policies</h2>
            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary} onClick={runRetention}>
                Run Retention Now
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setModal({ type: 'retention' })}
              >
                + Add Policy
              </button>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Table</th>
                  <th>Retain (days)</th>
                  <th>Last Run</th>
                </tr>
              </thead>
              <tbody>
                {retentionPolicies.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className={styles.mono}>{p.table_name}</td>
                    <td>{p.retain_days}</td>
                    <td>{p.last_run_at ? new Date(p.last_run_at).toLocaleString() : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {retentionPolicies.length === 0 && <div className={styles.empty}>No retention policies. Add one to automate data cleanup.</div>}
          </div>
        </section>
      )}

      {activeTab === 'agent-releases' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Agent Releases (Auto-Update)</h2>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setModal({ type: 'release' })}
            >
              + Add Release
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Download URL</th>
                  <th>Current</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {agentReleases.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.mono}>{r.version}</td>
                    <td className={styles.mono} title={r.download_url}>{r.download_url ? r.download_url.slice(0, 40) + '…' : '-'}</td>
                    <td>{r.is_current ? <span className={styles.badgeActive}>Current</span> : '-'}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agentReleases.length === 0 && <div className={styles.empty}>No agent releases. Add releases for agent auto-update.</div>}
          </div>
        </section>
      )}

      {modal?.type === 'channel' && (
        <ChannelModal
          onClose={() => setModal(null)}
          onSubmit={(type, name, config) => createChannel(type, name, config)}
        />
      )}
      {modal?.type === 'retention' && (
        <RetentionModal
          tables={RETENTION_TABLES}
          onClose={() => setModal(null)}
          onSubmit={(name, table_name, retain_days) => createRetentionPolicy(name, table_name, retain_days)}
        />
      )}
      {modal?.type === 'release' && (
        <ReleaseModal
          onClose={() => setModal(null)}
          onSubmit={(v, url, hash, notes, current) => createAgentRelease(v, url, hash, notes, current)}
        />
      )}
    </div>
    </PageShell>
  );
}

function ChannelModal({ onClose, onSubmit }) {
  const [type, setType] = useState('email');
  const [name, setName] = useState('');
  const [config, setConfig] = useState({ smtp_host: '', smtp_port: 587, from: '', to: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'email') {
      onSubmit(type, name, { smtp_host: config.smtp_host, smtp_port: config.smtp_port, from: config.from, to: config.to });
    } else if (type === 'webhook') {
      onSubmit(type, name, { url: config.url });
    } else if (type === 'slack') {
      onSubmit(type, name, { webhook_url: config.webhook_url });
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Add Notification Channel</h3>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <label>
            Type
            <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="email">Email</option>
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
            </select>
          </label>
          <label>
            Name
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alert Email" />
          </label>
          {type === 'email' && (
            <>
              <label>
                SMTP Host
                <input className={styles.input} value={config.smtp_host} onChange={(e) => setConfig((c) => ({ ...c, smtp_host: e.target.value }))} placeholder="smtp.example.com" />
              </label>
              <label>
                From
                <input className={styles.input} value={config.from} onChange={(e) => setConfig((c) => ({ ...c, from: e.target.value }))} placeholder="alerts@example.com" />
              </label>
              <label>
                To (comma-separated)
                <input className={styles.input} value={config.to} onChange={(e) => setConfig((c) => ({ ...c, to: e.target.value }))} placeholder="soc@example.com" />
              </label>
            </>
          )}
          {type === 'webhook' && (
            <label>
              Webhook URL
              <input className={styles.input} value={config.url || ''} onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))} placeholder="https://..." />
            </label>
          )}
          {type === 'slack' && (
            <label>
              Slack Webhook URL
              <input className={styles.input} value={config.webhook_url || ''} onChange={(e) => setConfig((c) => ({ ...c, webhook_url: e.target.value }))} placeholder="https://hooks.slack.com/..." />
            </label>
          )}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RetentionModal({ tables, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [table_name, setTableName] = useState('raw_events');
  const [retain_days, setRetainDays] = useState(90);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(name, table_name, retain_days);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Add Retention Policy</h3>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <label>
            Name
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Raw Events 90d" required />
          </label>
          <label>
            Table
            <select className={styles.select} value={table_name} onChange={(e) => setTableName(e.target.value)}>
              {tables.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            Retain (days)
            <input type="number" className={styles.input} value={retain_days} onChange={(e) => setRetainDays(e.target.value)} min={1} />
          </label>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReleaseModal({ onClose, onSubmit }) {
  const [version, setVersion] = useState('');
  const [download_url, setDownloadUrl] = useState('');
  const [checksum_sha256, setChecksum] = useState('');
  const [release_notes, setNotes] = useState('');
  const [is_current, setIsCurrent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(version, download_url, checksum_sha256, release_notes, is_current);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Add Agent Release</h3>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <label>
            Version
            <input className={styles.input} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.0" required />
          </label>
          <label>
            Download URL
            <input className={styles.input} value={download_url} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://..." />
          </label>
          <label>
            SHA256 Checksum
            <input className={styles.input} value={checksum_sha256} onChange={(e) => setChecksum(e.target.value)} placeholder="Optional" />
          </label>
          <label>
            Release Notes
            <textarea className={styles.input} value={release_notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional" />
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={is_current} onChange={(e) => setIsCurrent(e.target.checked)} />
            Mark as current (agents will update to this version)
          </label>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
