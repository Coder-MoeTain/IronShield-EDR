import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../components/PageShell';

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: String(s) };
  }
}

export default function XdrRealtime() {
  const [connected, setConnected] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const wsRef = useRef(null);

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      const data = safeParse(ev.data);
      setMsgs((prev) => {
        const next = [{ at: new Date().toISOString(), data }, ...prev];
        return next.slice(0, 200);
      });
    };
    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [wsUrl]);

  return (
    <PageShell
      kicker="XDR"
      title="Realtime"
      description="Live stream from the backend WebSocket bridge (/ws). Shows normalized events + detections as they flow through Kafka."
      actions={
        <span className={`falcon-badge ${connected ? 'falcon-badge-ok' : 'falcon-badge-warn'}`}>
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      }
    >
      <div className="ui-surface" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ color: 'var(--text-muted)' }}>
            WebSocket: <span className="mono">{wsUrl}</span>
          </div>
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={() => setMsgs([])}>
            Clear
          </button>
        </div>
        <div style={{ marginTop: '0.75rem', maxHeight: 520, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          {msgs.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>No messages yet.</div>
          ) : null}
          {msgs.map((m, i) => (
            <div key={`${m.at}-${i}`} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>
                  {new Date(m.at).toLocaleTimeString()}
                </div>
                <div className="mono" style={{ color: 'var(--text-muted)' }}>
                  {m.data?.type || 'message'}
                </div>
              </div>
              <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {JSON.stringify(m.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

