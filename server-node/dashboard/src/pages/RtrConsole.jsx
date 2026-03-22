import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './RtrConsole.module.css';

export default function RtrConsole() {
  const { api } = useAuth();
  const [endpoints, setEndpoints] = useState([]);
  const [endpointId, setEndpointId] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [cmd, setCmd] = useState('whoami');
  const [commands, setCommands] = useState([]);
  const [msg, setMsg] = useState('');
  const [poll, setPoll] = useState(null);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : []))
      .catch(() => setEndpoints([]));
  }, [api]);

  const refreshCommands = useCallback(async () => {
    if (!sessionId) return;
    const r = await api(`/api/admin/rtr/sessions/${sessionId}/commands`);
    const j = await r.json().catch(() => ({}));
    setCommands(j.commands || []);
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
      setMsg(`Session ${j.id} started. Add policy allowlist: include "rtr_shell" for this host's EDR policy.`);
    } catch (e) {
      setMsg(e.message || 'Failed');
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
      setPoll(j);
      await refreshCommands();
    } catch (e) {
      setMsg(e.message || 'Failed');
    }
  };

  const closeSession = async () => {
    if (!sessionId) return;
    await api(`/api/admin/rtr/sessions/${sessionId}/close`, { method: 'POST' });
    setSessionId(null);
    setCommands([]);
  };

  return (
    <PageShell
      kicker="Respond"
      title="Real Time Response (RTR)"
      description="Allowlisted remote shell — not full CrowdStrike RTR. Commands: whoami, hostname, ipconfig, ver, systeminfo, netstat, route, arp, getmac, echo."
      actions={
        <Link to="/policies" className="falcon-btn falcon-btn-ghost">
          Policies → allow rtr_shell
        </Link>
      }
    >
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Session</h3>
          <label className={styles.label}>
            Endpoint
            <select
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
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
          <div className={styles.actions}>
            <button type="button" className="falcon-btn" onClick={startSession} disabled={!endpointId}>
              Start session
            </button>
            <button type="button" className="falcon-btn falcon-btn-ghost" onClick={closeSession} disabled={!sessionId}>
              Close session
            </button>
          </div>
          {sessionId && <p className={styles.meta}>Session ID: <span className="mono">{sessionId}</span></p>}
        </div>

        <div className={styles.card}>
          <h3>Command</h3>
          <input
            className={styles.input}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="whoami"
            disabled={!sessionId}
          />
          <button type="button" className="falcon-btn" onClick={runCmd} disabled={!sessionId}>
            Queue command
          </button>
          {poll && <p className={styles.hint}>Last queue: {JSON.stringify(poll)}</p>}
        </div>
      </div>

      {msg && <p className={styles.banner}>{msg}</p>}

      <div className={styles.output}>
        <h3>History (polls every 2.5s)</h3>
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
                  <pre className={styles.pre}>
                    {c.stdout || c.stderr || c.error_message || '—'}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {commands.length === 0 && <p className={styles.muted}>No commands yet.</p>}
      </div>
    </PageShell>
  );
}
