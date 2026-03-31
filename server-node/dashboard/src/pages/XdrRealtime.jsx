import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import styles from './XdrWorkspace.module.css';

const STREAM_KEYS = [
  { key: 'xdr_event', label: 'XDR events' },
  { key: 'xdr_detection', label: 'Detections' },
  { key: 'kafka', label: 'Kafka' },
];

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: String(s) };
  }
}

function typeClass(t) {
  if (t === 'kafka') return styles.typeKafka;
  if (t === 'xdr_event') return styles.typeXdrEvent;
  if (t === 'xdr_detection') return styles.typeXdrDetection;
  if (t === 'hello' || t === 'subscribed') return styles.typeHello;
  return styles.typeOther;
}

export default function XdrRealtime() {
  const { api } = useAuth();
  const [connected, setConnected] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [streams, setStreams] = useState({ xdr_event: true, xdr_detection: true, kafka: true });
  const [endpointId, setEndpointId] = useState('');
  const [endpoints, setEndpoints] = useState([]);
  const [paused, setPaused] = useState(false);
  const wsRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }, []);

  const sendSubscribe = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const list = STREAM_KEYS.filter((s) => streams[s.key]).map((s) => s.key);
    ws.send(
      JSON.stringify({
        type: 'subscribe',
        streams: list.length ? list : ['xdr_event', 'xdr_detection', 'kafka'],
        endpoint_id: endpointId ? parseInt(endpointId, 10) || null : null,
      })
    );
  }, [streams, endpointId]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=300')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : d?.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [api]);

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch {
      setConnected(false);
      return undefined;
    }

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      if (pausedRef.current) return;
      const data = safeParse(ev.data);
      setMsgs((prev) => {
        const next = [{ at: new Date().toISOString(), data }, ...prev];
        return next.slice(0, 250);
      });
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [wsUrl]);

  useEffect(() => {
    if (!connected) return;
    sendSubscribe();
  }, [connected, sendSubscribe]);

  const toggleStream = (key) => {
    setStreams((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clear = () => setMsgs([]);

  return (
    <PageShell
      kicker="XDR"
      title="Live stream"
      description="WebSocket bridge at /ws — subscribe to XDR events, detections, and Kafka fan-out. Filter by endpoint to reduce noise."
      actions={
        <>
          <Link to="/xdr" className="falcon-btn falcon-btn-ghost">
            ← XDR hub
          </Link>
          <span className={`falcon-badge ${connected ? 'falcon-badge-ok' : 'falcon-badge-warn'}`}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </>
      }
    >
      <div className={styles.wrap}>
        <p className={styles.intro}>
          The server sends a hello on connect. Use stream toggles to match the Kafka bridge (when enabled). Endpoint
          filter matches <code className="mono">endpoint_id</code> on payloads when present.
        </p>

        <div className={`ui-surface ${styles.rtBar}`} style={{ padding: '0.85rem 1rem' }}>
          <div className={styles.rtFilters}>
            <label>
              <span className={styles.statLabel} style={{ display: 'block', marginBottom: '0.25rem' }}>
                Endpoint scope
              </span>
              <select
                className={styles.select}
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
              >
                <option value="">All endpoints</option>
                {endpoints.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.hostname || e.name || `#${e.id}`}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className={styles.statLabel} style={{ display: 'block', marginBottom: '0.35rem' }}>
                Streams
              </span>
              <div className={styles.chipRow}>
                {STREAM_KEYS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`${styles.chip} ${streams[s.key] ? styles.chipOn : ''}`}
                    onClick={() => toggleStream(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="falcon-btn falcon-btn-ghost" onClick={() => setPaused((p) => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="falcon-btn falcon-btn-ghost" onClick={clear}>
              Clear
            </button>
          </div>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} className="mono">
          {wsUrl} · {msgs.length} message{msgs.length === 1 ? '' : 's'} buffered
        </div>

        <div className={styles.rtFeed}>
          {msgs.length === 0 ? (
            <div style={{ padding: '1.5rem' }}>
              <FalconEmptyState
                title={connected ? 'Waiting for traffic' : 'Connecting…'}
                description={
                  connected
                    ? 'Kafka bridge must be enabled on the server for kafka-type messages. XDR publishes when the pipeline emits.'
                    : 'Check that the API server is running and WebSockets are not blocked by a proxy.'
                }
              />
            </div>
          ) : null}
          {msgs.map((m, i) => {
            const t = m.data?.type || 'message';
            return (
              <div key={`${m.at}-${i}`} className={styles.rtRow}>
                <div className={styles.rtMeta}>
                  <div className="mono" style={{ color: 'var(--text-muted)' }}>
                    {new Date(m.at).toLocaleString()}
                  </div>
                  <span className={`${styles.typeBadge} ${typeClass(t)}`}>{t}</span>
                </div>
                <pre className={styles.pre}>{JSON.stringify(m.data, null, 2)}</pre>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
