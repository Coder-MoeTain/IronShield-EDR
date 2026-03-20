import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ProcessMonitor.module.css';

export default function ProcessMonitor() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processes, setProcesses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    endpointId: searchParams.get('endpointId') || '',
    hostname: '',
    processName: '',
    suspectOnly: searchParams.get('suspectOnly') === 'true',
    dateFrom: '',
    dateTo: '',
    limit: 100,
    offset: 0,
  });
  const [selected, setSelected] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [endpoints, setEndpoints] = useState([]);

  const fetchData = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== false) params.set(k, v);
    });
    api(`/api/admin/process-monitor?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setProcesses(data.processes || []);
        setSummary(data.summary || {});
      })
      .catch(() => setProcesses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [filters]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : (d?.endpoints || [])))
      .catch(() => setEndpoints([]));
  }, []);

  const truncate = (s, len = 50) => {
    if (!s) return '-';
    return s.length > len ? s.slice(0, len) + '…' : s;
  };

  const doAction = async (action, proc) => {
    setActionMsg('');
    try {
      let r;
      if (action === 'kill' && proc.process_id) {
        r = await api(`/api/admin/endpoints/${proc.endpoint_id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ action_type: 'kill_process', parameters: { process_id: Number(proc.process_id) } }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        setActionMsg('Kill process queued');
      } else if (action === 'isolate') {
        r = await api(`/api/admin/endpoints/${proc.endpoint_id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ action_type: 'simulate_isolation' }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        setActionMsg('Isolation simulated');
      } else if (action === 'triage') {
        r = await api(`/api/admin/endpoints/${proc.endpoint_id}/triage-request`, {
          method: 'POST',
          body: JSON.stringify({ request_type: 'full' }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        setActionMsg('Triage requested');
      } else if (action === 'investigate') {
        r = await api('/api/admin/investigations', {
          method: 'POST',
          body: JSON.stringify({
            title: `Investigation: ${proc.process_name} on ${proc.endpoint_hostname}`,
            description: `Process: ${proc.process_name}\nPath: ${proc.process_path}\nUser: ${proc.username}`,
            endpoint_id: proc.endpoint_id,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        setActionMsg('Investigation created');
        navigate(`/investigations/${data.id}`);
      } else if (action === 'kill' && !proc.process_id) {
        setActionMsg('No process ID available');
        return;
      }
      fetchData();
    } catch (e) {
      setActionMsg('Failed: ' + (e.message || 'Unknown error'));
    }
  };

  const suspectBadge = (proc) => {
    if (!proc.is_suspect) return null;
    const reason = proc.suspect_reason || 'suspicious';
    const cls = reason === 'alert' ? styles.alert : reason === 'suspicious_path' ? styles.suspiciousPath : styles.suspiciousProc;
    return <span className={`${styles.suspectBadge} ${cls}`}>{reason.replace('_', ' ')}</span>;
  };

  if (loading && processes.length === 0) return <div className={styles.loading}>Loading process monitor...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>◉</span> Process Monitor
        </h1>
        <div className={styles.headerActions}>
          <button onClick={fetchData} className={styles.refreshBtn}>↻ Refresh</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{processes.length}</span>
          <span className={styles.statLabel}>Processes (current view)</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{processes.filter((p) => p.is_suspect).length}</span>
          <span className={styles.statLabel}>Suspect in view</span>
        </div>
        <div className={`${styles.statCard} ${styles.statWarn}`}>
          <span className={styles.statValue}>{summary?.suspect_count_24h ?? '-'}</span>
          <span className={styles.statLabel}>Suspect (24h)</span>
        </div>
      </div>

      <div className={styles.filters}>
        <input
          placeholder="Hostname"
          value={filters.hostname}
          onChange={(e) => setFilters((f) => ({ ...f, hostname: e.target.value, offset: 0 }))}
        />
        <input
          placeholder="Process name"
          value={filters.processName}
          onChange={(e) => setFilters((f) => ({ ...f, processName: e.target.value, offset: 0 }))}
        />
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={filters.suspectOnly}
            onChange={(e) => setFilters((f) => ({ ...f, suspectOnly: e.target.checked, offset: 0 }))}
          />
          Suspect only
        </label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, offset: 0 }))}
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, offset: 0 }))}
        />
      </div>

      {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Host</th>
              <th>Process</th>
              <th>PID</th>
              <th>User</th>
              <th>Parent</th>
              <th>Path</th>
              <th>Hash</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((proc) => (
              <tr
                key={proc.id}
                className={proc.is_suspect ? styles.suspectRow : ''}
                onClick={() => setSelected(selected?.id === proc.id ? null : proc)}
              >
                <td className={styles.mono}>{new Date(proc.timestamp).toLocaleString()}</td>
                <td>
                  <span>
                    <Link to={`/endpoints/${proc.endpoint_id}`}>{proc.endpoint_hostname || proc.hostname}</Link>
                    <Link to={`/normalized-events/${proc.id}`} className={styles.eventLink} title="View event"> ↗</Link>
                  </span>
                </td>
                <td className={styles.processCell}>
                  <span className={styles.processName}>{proc.process_name || '-'}</span>
                  {suspectBadge(proc)}
                </td>
                <td className={styles.mono}>{proc.process_id ?? '-'}</td>
                <td>{proc.username || '-'}</td>
                <td className={styles.parentCell}>{proc.parent_process_name || '-'}</td>
                <td className={`${styles.pathCell} mono`} title={proc.process_path || proc.command_line}>
                  {truncate(proc.process_path || proc.command_line, 40)}
                </td>
                <td className={`${styles.hashCell} mono`} title={proc.file_hash_sha256}>
                  {proc.file_hash_sha256 ? truncate(proc.file_hash_sha256, 12) : '-'}
                </td>
                <td>
                  {proc.linked_alerts?.length > 0 ? (
                    <span className={styles.alertLinks}>
                      {proc.linked_alerts.map((a) => (
                        <Link key={a.id} to={`/alerts/${a.id}`} className={styles.alertLink}>
                          {a.severity}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); doAction('kill', proc); }}
                    title="Kill process"
                  >
                    Kill
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); doAction('isolate', proc); }}
                    title="Simulate isolation"
                  >
                    Isolate
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); doAction('triage', proc); }}
                    title="Collect triage"
                  >
                    Triage
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); doAction('investigate', proc); }}
                    title="Create investigation"
                  >
                    Investigate
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); navigate(`/endpoints/${proc.endpoint_id}/process-tree`); }}
                    title="View process tree"
                  >
                    Tree
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {processes.length === 0 && <div className={styles.empty}>No processes found.</div>}
      </div>

      {selected && (
        <div className={styles.detailPanel}>
          <h3>Process Details</h3>
          <dl>
            <dt>Process</dt>
            <dd>{selected.process_name}</dd>
            <dt>Path</dt>
            <dd className="mono" style={{ wordBreak: 'break-all' }}>{selected.process_path || '-'}</dd>
            <dt>Command Line</dt>
            <dd className="mono" style={{ wordBreak: 'break-all' }}>{selected.command_line || '-'}</dd>
            <dt>Hash</dt>
            <dd className="mono">{selected.file_hash_sha256 || '-'}</dd>
            <dt>Linked Alerts</dt>
            <dd>
              {selected.linked_alerts?.length > 0 ? (
                selected.linked_alerts.map((a) => (
                  <Link key={a.id} to={`/alerts/${a.id}`}>
                    {a.title} ({a.severity})
                  </Link>
                ))
              ) : (
                '-'
              )}
            </dd>
          </dl>
          <button className={styles.closeDetail} onClick={() => setSelected(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
