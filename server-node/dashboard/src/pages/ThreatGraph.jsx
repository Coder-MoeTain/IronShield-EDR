import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './ThreatGraph.module.css';

function layoutNodes(nodes) {
  const pos = new Map();
  const hosts = nodes.filter((n) => n.type === 'host');
  const alerts = nodes.filter((n) => n.type === 'alert');
  const cx = 400;
  const cy = 280;
  const rHost = 220;
  const rAlert = 160;
  hosts.forEach((n, i) => {
    const a = (2 * Math.PI * i) / Math.max(hosts.length, 1);
    pos.set(n.id, { x: cx + Math.cos(a) * rHost, y: cy + Math.sin(a) * rHost });
  });
  alerts.forEach((n, i) => {
    const a = (2 * Math.PI * i) / Math.max(alerts.length, 1) + 0.4;
    pos.set(n.id, { x: cx + Math.cos(a) * rAlert, y: cy + Math.sin(a) * rAlert });
  });
  nodes.forEach((n) => {
    if (!pos.has(n.id)) pos.set(n.id, { x: cx, y: cy });
  });
  return pos;
}

export default function ThreatGraph() {
  const { api } = useAuth();
  const [data, setData] = useState({ nodes: [], links: [] });
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/api/admin/threat-graph')
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [api]);

  const { pos, lines } = useMemo(() => {
    const nodes = data.nodes || [];
    const links = data.links || [];
    const p = layoutNodes(nodes);
    const ln = [];
    for (const l of links) {
      const s = p.get(l.source);
      const t = p.get(l.target);
      if (s && t) ln.push({ x1: s.x, y1: s.y, x2: t.x, y2: t.y });
    }
    return { pos: p, lines: ln };
  }, [data]);

  return (
    <PageShell
      kicker="Explore"
      title="Threat graph"
      description="Hosts linked to recent detections (self-hosted graph — not CrowdStrike Threat Graph)."
      actions={
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={() => window.location.reload()}>
          Refresh
        </button>
      }
    >
      {err ? <p className={styles.err}>{err}</p> : null}
      <div className={styles.wrap}>
        <svg className={styles.svg} viewBox="0 0 800 560">
          {lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={styles.edge} />
          ))}
          {(data.nodes || []).map((n) => {
            const pt = pos.get(n.id);
            if (!pt) return null;
            const isHost = n.type === 'host';
            return (
              <g key={n.id} transform={`translate(${pt.x}, ${pt.y})`}>
                <circle r={isHost ? 14 : 11} className={isHost ? styles.nodeHost : styles.nodeAlert} />
                <text y={isHost ? 32 : 28} textAnchor="middle" className={styles.label}>
                  {(n.label || n.id).slice(0, 28)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className={styles.hint}>
        Solid nodes: hosts · Smaller nodes: alerts. <Link to="/alerts">Open detections</Link>
      </p>
    </PageShell>
  );
}
