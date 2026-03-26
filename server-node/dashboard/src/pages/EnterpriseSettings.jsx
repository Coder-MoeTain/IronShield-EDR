import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './EnterpriseSettings.module.css';

const TABS = [
  { id: 'notifications', label: 'Notification Channels', icon: '🔔' },
  { id: 'retention', label: 'Retention Policies', icon: '📦' },
  { id: 'agent-releases', label: 'Agent Releases', icon: '🚀' },
  { id: 'xdr-ip-feeds', label: 'Threat Intel (IP feeds)', icon: '🌐' },
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
  const [ipFeeds, setIpFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', isError: false });
  const [modal, setModal] = useState(null);

  const fetchChannels = () =>
    api('/api/admin/notification-channels')
      .then((r) => r.json())
      .then(setChannels)
      .catch(() => setChannels([]));
  const fetchRetention = () =>
    api('/api/admin/retention-policies')
      .then((r) => r.json())
      .then(setRetentionPolicies)
      .catch(() => setRetentionPolicies([]));
  const fetchReleases = () =>
    api('/api/admin/agent-releases')
      .then((r) => r.json())
      .then(setAgentReleases)
      .catch(() => setAgentReleases([]));
  const fetchIpFeeds = () =>
    api('/api/admin/xdr/ip-feeds')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setIpFeeds(Array.isArray(d) ? d : []))
      .catch(() => setIpFeeds([]));

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChannels(), fetchRetention(), fetchReleases(), fetchIpFeeds()]).finally(() => setLoading(false));
  }, [activeTab]);

  const syncIpFeed = async (id) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/xdr/ip-feeds/${id}/sync`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMsg({ text: `Sync complete. Imported ${d.imported ?? 0}/${d.total ?? 0} IPs.`, isError: false });
      fetchIpFeeds();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const createIpFeed = async (payload) => {
    setMsg({ text: '', isError: false });
    const r = await api('/api/admin/xdr/ip-feeds', { method: 'POST', body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    setModal(null);
    fetchIpFeeds();
    setMsg({ text: 'Feed created.', isError: false });
  };

  const deleteIpFeed = async (id) => {
    if (!confirm('Delete this IP feed?')) return;
    setMsg({ text: '', isError: false });
    const r = await api(`/api/admin/xdr/ip-feeds/${id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    fetchIpFeeds();
    setMsg({ text: 'Feed deleted.', isError: false });
  };

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

  const toggleChannelActive = async (id, is_active) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/notification-channels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ text: 'Channel updated', isError: false });
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

  const deleteRetentionPolicy = async (id) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/retention-policies/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ text: 'Policy deleted', isError: false });
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

  const setCurrentRelease = async (id) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/agent-releases/${id}`, { method: 'PATCH', body: JSON.stringify({ is_current: true }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ text: 'Current release updated', isError: false });
      fetchReleases();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const deleteAgentRelease = async (id) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/agent-releases/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ text: 'Release deleted', isError: false });
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.id}>
                    <td><span className={styles.badge}>{c.type}</span></td>
                    <td>{c.name || '-'}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => toggleChannelActive(c.id, !c.is_active)}
                        title="Toggle channel enable/disable"
                      >
                        {c.is_active ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                    <td style={{ width: 1, whiteSpace: 'nowrap' }}>
                      <span className={styles.mono} style={{ color: 'var(--text-muted)' }}>
                        id {c.id}
                      </span>
                    </td>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {retentionPolicies.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className={styles.mono}>{p.table_name}</td>
                    <td>{p.retain_days}</td>
                    <td>{p.last_run_at ? new Date(p.last_run_at).toLocaleString() : 'Never'}</td>
                    <td style={{ width: 1, whiteSpace: 'nowrap' }}>
                      <button type="button" className={styles.btnSecondary} onClick={() => deleteRetentionPolicy(p.id)}>
                        Delete
                      </button>
                    </td>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {agentReleases.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.mono}>{r.version}</td>
                    <td className={styles.mono} title={r.download_url}>{r.download_url ? r.download_url.slice(0, 40) + '…' : '-'}</td>
                    <td>
                      {r.is_current ? (
                        <span className={styles.badgeActive}>Current</span>
                      ) : (
                        <button type="button" className={styles.btnSecondary} onClick={() => setCurrentRelease(r.id)}>
                          Set current
                        </button>
                      )}
                    </td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
                    <td style={{ width: 1, whiteSpace: 'nowrap' }}>
                      <button type="button" className={styles.btnSecondary} onClick={() => deleteAgentRelease(r.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agentReleases.length === 0 && <div className={styles.empty}>No agent releases. Add releases for agent auto-update.</div>}
          </div>
        </section>
      )}

      {activeTab === 'xdr-ip-feeds' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Third-party IP blacklist feeds</h2>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setModal({ type: 'ip-feed' })}
            >
              + Add feed
            </button>
          </div>
          <p className={styles.hint}>
            Configure a third-party security API / feed URL. Sync imports IPs into <strong>IOC watchlist</strong> (type:
            ip) so they match against network events.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Severity</th>
                  <th>Active</th>
                  <th>Last Sync</th>
                  <th>Last Error</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ipFeeds.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td className={styles.mono} title={f.url}>
                      {String(f.url || '').slice(0, 48)}
                      {(String(f.url || '').length || 0) > 48 ? '…' : ''}
                    </td>
                    <td className={styles.mono}>{f.severity || 'high'}</td>
                    <td>{f.is_active ? <span className={styles.badgeActive}>On</span> : <span className={styles.badgeOff}>Off</span>}</td>
                    <td>{f.last_sync_at ? new Date(f.last_sync_at).toLocaleString() : '—'}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.last_error || '—'}
                    </td>
                    <td style={{ width: 1, whiteSpace: 'nowrap' }}>
                      <button type="button" className={styles.btnSecondary} onClick={() => syncIpFeed(f.id)}>
                        Sync
                      </button>{' '}
                      <button type="button" className={styles.btnSecondary} onClick={() => deleteIpFeed(f.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ipFeeds.length === 0 && (
              <div className={styles.empty}>No feeds configured. Add one to import blacklist IPs.</div>
            )}
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
      {modal?.type === 'ip-feed' && (
        <IpFeedModal onClose={() => setModal(null)} onSubmit={createIpFeed} />
      )}
    </div>
    </PageShell>
  );
}

function IpFeedModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('Authorization');
  const [authHeaderValue, setAuthHeaderValue] = useState('');
  const [jsonPath, setJsonPath] = useState('');
  const [severity, setSeverity] = useState('high');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name,
      url,
      auth_header_name: authHeaderName.trim() || undefined,
      auth_header_value: authHeaderValue.trim() || undefined,
      json_path: jsonPath.trim() || undefined,
      severity,
      is_active: 1,
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Add IP blacklist feed</h3>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <label>
            Name
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            URL
            <input className={styles.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
          </label>
          <label>
            Auth header name (optional)
            <input className={styles.input} value={authHeaderName} onChange={(e) => setAuthHeaderName(e.target.value)} placeholder="Authorization" />
          </label>
          <label>
            Auth header value (optional)
            <input className={styles.input} value={authHeaderValue} onChange={(e) => setAuthHeaderValue(e.target.value)} placeholder="Bearer …" />
          </label>
          <label>
            JSON path (optional)
            <input className={styles.input} value={jsonPath} onChange={(e) => setJsonPath(e.target.value)} placeholder="data.items" />
            <span className={styles.hint}>
              If the response is JSON and IPs live under a nested array, set the dot-path to that array.
            </span>
          </label>
          <label>
            Severity
            <select className={styles.select} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
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
