import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import PageShell from '../components/PageShell';
import PermissionGate from '../components/PermissionGate';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import { falconSeverityClass } from '../utils/falconUi';
import { asJsonList } from '../utils/apiJson';
import styles from './IOCs.module.css';

const IOC_TYPES = ['hash', 'ip', 'domain', 'path', 'url'];

export default function IOCs() {
  const { api } = useAuth();
  const { confirm } = useConfirm();
  const [searchParams] = useSearchParams();
  const [iocs, setIocs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const typeFromUrl = searchParams.get('type');
  const [newType, setNewType] = useState(() =>
    typeFromUrl && IOC_TYPES.includes(typeFromUrl) ? typeFromUrl : 'hash'
  );
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(() =>
    typeFromUrl && IOC_TYPES.includes(typeFromUrl) ? typeFromUrl : 'all'
  );

  useEffect(() => {
    const t = searchParams.get('type');
    if (t && IOC_TYPES.includes(t)) {
      setTypeFilter(t);
      setNewType(t);
      if (searchParams.get('add') === '1') setShowAdd(true);
    }
  }, [searchParams]);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api('/api/admin/iocs'), api('/api/admin/iocs/matches')])
      .then(async ([r1, r2]) => {
        setIocs(await asJsonList(r1));
        setMatches(await asJsonList(r2));
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
    if (
      !(await confirm({
        title: 'Delete IOC',
        message: 'Remove this indicator from the library?',
        danger: true,
        confirmLabel: 'Delete',
      }))
    )
      return;
    await api(`/api/admin/iocs/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const filteredIocs = iocs.filter((ioc) => {
    const q = query.trim().toLowerCase();
    const value = (ioc.ioc_value || '').toLowerCase();
    const type = (ioc.ioc_type || '').toLowerCase();
    const severity = (ioc.severity || '').toLowerCase();
    const queryMatch = !q || value.includes(q) || type.includes(q) || severity.includes(q);
    const typeMatch = typeFilter === 'all' || type === typeFilter;
    return queryMatch && typeMatch;
  });

  const matchesLast24h = matches.filter((m) => {
    if (!m.matched_at) return false;
    const ts = new Date(m.matched_at).getTime();
    return Number.isFinite(ts) && Date.now() - ts <= 24 * 60 * 60 * 1000;
  }).length;

  const highPriorityIocs = iocs.filter((i) => ['high', 'critical'].includes((i.severity || '').toLowerCase())).length;

  if (loading && iocs.length === 0) return <PageShell loading loadingLabel="Loading IOCs…" />;

  return (
    <PageShell
      kicker="Intel"
      title="IOC watchlist"
      description="Hash, IP, domain, and path indicators — matched during event ingestion."
      actions={
        <PermissionGate permission="rules:write">
          <button type="button" onClick={() => setShowAdd(!showAdd)} className="falcon-btn falcon-btn-primary">
            + Add IOC
          </button>
        </PermissionGate>
      }
    >
    <div className={styles.container}>
      <FalconTableShell
        toolbar={
          <>
            <div className={styles.toolbar}>
              <input
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search IOC value, type, or severity"
                aria-label="Search IOCs"
              />
              <select className={styles.filter} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                <option value="hash">Hash</option>
                <option value="ip">IP</option>
                <option value="domain">Domain</option>
                <option value="path">Path</option>
                <option value="url">URL</option>
              </select>
            </div>
            <div className={styles.metrics}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Watchlist entries</span>
                <strong className={styles.metricValue}>{iocs.length}</strong>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>High priority IOCs</span>
                <strong className={styles.metricValue}>{highPriorityIocs}</strong>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Total matches</span>
                <strong className={styles.metricValue}>{matches.length}</strong>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>Matches (24h)</span>
                <strong className={styles.metricValue}>{matchesLast24h}</strong>
              </div>
            </div>
          </>
        }
      >
      {showAdd && (
        <PermissionGate permission="rules:write">
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
        </PermissionGate>
      )}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2>Watchlist ({filteredIocs.length})</h2>
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
                {filteredIocs.map((i) => (
                  <tr key={i.id}>
                    <td className={styles.mono}>{i.ioc_type}</td>
                    <td className={styles.valueCell} title={i.ioc_value}>{i.ioc_value?.slice(0, 40)}{(i.ioc_value?.length || 0) > 40 ? '…' : ''}</td>
                    <td><span className={falconSeverityClass(i.severity)}>{i.severity}</span></td>
                    <td>
                      <PermissionGate permission="rules:write">
                        <button type="button" onClick={() => deleteIoc(i.id)} className={styles.delBtn}>Delete</button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredIocs.length === 0 && (
              <FalconEmptyState
                title="No matching IOCs"
                description="Adjust search or type filter, or add new indicators with + Add IOC."
              />
            )}
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
              <FalconEmptyState
                title="No IOC matches yet"
                description="When telemetry matches a watchlist value, matches appear here with endpoint context."
              />
            )}
          </div>
        </div>
      </div>
      </FalconTableShell>
    </div>
    </PageShell>
  );
}
