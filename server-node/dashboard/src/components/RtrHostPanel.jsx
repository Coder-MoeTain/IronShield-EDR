import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './RtrHostPanel.module.css';

/**
 * Real Time Response (RTR) lite: allowlisted shell session for one host.
 * @param {{ endpointId: string, hostname?: string | null, showHostPicker?: boolean, endpoints?: Array<{ id: number, hostname: string }> }} props
 */
export default function RtrHostPanel({
  endpointId: fixedEndpointId,
  hostname = null,
  showHostPicker = false,
  endpoints = [],
}) {
  const { api } = useAuth();
  const [pickedId, setPickedId] = useState(fixedEndpointId || '');
  const endpointId = showHostPicker ? pickedId : fixedEndpointId;

  useEffect(() => {
    if (!showHostPicker && fixedEndpointId) setPickedId(fixedEndpointId);
  }, [showHostPicker, fixedEndpointId]);

  const [sessionId, setSessionId] = useState(null);
  const [cmd, setCmd] = useState('whoami');
  const [commands, setCommands] = useState([]);
  const [msg, setMsg] = useState('');
  const [lastQueue, setLastQueue] = useState(null);

  const refreshCommands = useCallback(async () => {
    if (!sessionId) return;
    const r = await api(`/api/admin/rtr/sessions/${sessionId}/commands`);
    const j = await r.json().catch(() => ({}));
    setCommands(Array.isArray(j.commands) ? j.commands : []);
  }, [api, sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    refreshCommands();
    const t = setInterval(refreshCommands, 2500);
    return () => clearInterval(t);
  }, [sessionId, refreshCommands]);

  const startSession = async () => {
    setMsg('');
    if (!endpointId) {
      setMsg('Select an endpoint');
      return;
    }
    try {
      const r = await api('/api/admin/rtr/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_id: parseInt(endpointId, 10) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSessionId(j.id);
      setMsg(
        `Session ${j.id} started. Policy must allow "rtr_shell" for this host (Policies → EDR → allowed response actions).`
      );
    } catch (e) {
      setMsg(e.message || 'Failed to start session');
    }
  };

  const runCmd = async () => {
    setMsg('');
    if (!sessionId || !cmd.trim()) return;
    try {
      const r = await api(`/api/admin/rtr/sessions/${sessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (j.status === 'rejected') {
        setMsg(j.error || 'Command was rejected (allowlist or invalid characters).');
        setLastQueue(j);
        await refreshCommands();
        return;
      }
      setLastQueue(j);
      await refreshCommands();
    } catch (e) {
      setMsg(e.message || 'Command failed');
    }
  };

  const closeSession = async () => {
    if (!sessionId) return;
    await api(`/api/admin/rtr/sessions/${sessionId}/close`, { method: 'POST' });
    setSessionId(null);
    setCommands([]);
    setLastQueue(null);
  };

  const canStart = Boolean(endpointId);

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h4>Session</h4>
          {showHostPicker ? (
            <label className={styles.label}>
              Endpoint
              <select
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
                className={styles.select}
              >
                <option value="">— select —</option>
                {endpoints.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.hostname} (id {e.id})
                  </option>
                ))}
              </select>
            </label>
          ) : hostname ? (
            <p className={styles.meta}>
              Host: <strong>{hostname}</strong>
              <span className="mono" style={{ marginLeft: '0.35rem' }}>
                #{endpointId}
              </span>
            </p>
          ) : (
            <p className={styles.meta}>
              Endpoint <span className="mono">#{endpointId}</span>
            </p>
          )}
          <div className={styles.rowActions}>
            <button type="button" className="falcon-btn" onClick={startSession} disabled={!canStart}>
              Start session
            </button>
            <button type="button" className="falcon-btn falcon-btn-ghost" onClick={closeSession} disabled={!sessionId}>
              Close session
            </button>
          </div>
          {sessionId ? (
            <p className={styles.meta}>
              Session ID: <span className="mono">{sessionId}</span>
            </p>
          ) : null}
        </div>

        <div className={styles.card}>
          <h4>Command</h4>
          <p className={styles.hint}>
            Allowlisted: whoami, hostname, ipconfig, ver, systeminfo, netstat, route, arp, getmac, echo.
          </p>
          <input
            className={styles.input}
            style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', marginBottom: '0.5rem' }}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="whoami"
            disabled={!sessionId}
          />
          <button type="button" className="falcon-btn" onClick={runCmd} disabled={!sessionId}>
            Queue command
          </button>
          {lastQueue ? (
            <p className={styles.hint}>
              Queued: #{lastQueue.command_id} · {lastQueue.status}
              {lastQueue.response_action_id != null ? ` · action ${lastQueue.response_action_id}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      {msg ? <p className={styles.banner}>{msg}</p> : null}

      <div className={styles.output}>
        <h4>Output (refreshes every 2.5s)</h4>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Command</th>
              <th>Status</th>
              <th>Output</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.id}</td>
                <td className="mono">{c.command_text}</td>
                <td>{c.status}</td>
                <td>
                  <pre className={styles.pre}>{c.stdout || c.stderr || c.error_message || '—'}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {commands.length === 0 ? <p className={styles.muted}>No commands yet.</p> : null}
      </div>
    </div>
  );
}
