import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './ThreatGraph.module.css';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function normSeverity(v) {
  const s = String(v || '').toLowerCase();
  if (SEVERITY_ORDER.includes(s)) return s;
  return 'info';
}

function severityRank(v) {
  const idx = SEVERITY_ORDER.indexOf(normSeverity(v));
  return idx === -1 ? SEVERITY_ORDER.length : idx;
}

function layoutNodes(nodes, links) {
  const pos = new Map();
  const cx = 640;
  const cy = 320;
  const hosts = nodes.filter((n) => n.type === 'host').sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
  const alerts = nodes
    .filter((n) => n.type === 'alert')
    .sort((a, b) => severityRank(a.meta?.severity) - severityRank(b.meta?.severity));
  const rHost = 250;
  const rAlert = 160;

  hosts.forEach((n, i) => {
    const a = (2 * Math.PI * i) / Math.max(hosts.length, 1);
    pos.set(n.id, { x: cx + Math.cos(a) * rHost, y: cy + Math.sin(a) * rHost });
  });

  alerts.forEach((n, i) => {
    const a = (2 * Math.PI * i) / Math.max(alerts.length, 1) - Math.PI / 2;
    pos.set(n.id, { x: cx + Math.cos(a) * rAlert, y: cy + Math.sin(a) * rAlert });
  });

  nodes.forEach((n) => {
    if (!pos.has(n.id)) pos.set(n.id, { x: cx, y: cy });
  });

  const degrees = new Map();
  for (const l of links) {
    degrees.set(l.source, (degrees.get(l.source) || 0) + 1);
    degrees.set(l.target, (degrees.get(l.target) || 0) + 1);
  }

  // Pull highly connected nodes slightly toward center.
  nodes.forEach((n) => {
    const d = degrees.get(n.id) || 0;
    if (!d) return;
    const p = pos.get(n.id);
    if (!p) return;
    const t = Math.min(0.2, d / 100);
    pos.set(n.id, {
      x: p.x + (cx - p.x) * t,
      y: p.y + (cy - p.y) * t,
    });
  });

  return pos;
}

export default function ThreatGraph() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ nodes: [], links: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [err, setErr] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setErr(null);
    api('/api/admin/threat-graph')
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((body) => {
        const next = {
          nodes: Array.isArray(body?.nodes) ? body.nodes : [],
          links: Array.isArray(body?.links) ? body.links : [],
        };
        setData(next);
        if (!next.nodes.some((n) => n.id === selectedId)) setSelectedId(next.nodes[0]?.id || null);
      })
      .catch((e) => setErr(e.message || 'Failed to load threat graph'))
      .finally(() => setLoading(false));
  }, [api, selectedId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { nodes, links, pos, lines, stats, selectedNode, selectedNeighbors } = useMemo(() => {
    const nodes = data.nodes || [];
    const links = data.links || [];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const p = layoutNodes(nodes, links);
    const q = search.trim().toLowerCase();
    const seed = new Set();

    for (const n of nodes) {
      const txt = `${n.label || ''} ${n.id} ${n.meta?.severity || ''}`.toLowerCase();
      const typeOk = typeFilter === 'all' || n.type === typeFilter;
      const sevOk = n.type !== 'alert' || severityFilter === 'all' || normSeverity(n.meta?.severity) === severityFilter;
      const queryOk = !q || txt.includes(q);
      if (typeOk && sevOk && queryOk) seed.add(n.id);
    }

    // Keep one-hop neighbors for context around matching nodes.
    const visibleNodeIds = new Set(seed);
    for (const l of links) {
      if (seed.has(l.source) || seed.has(l.target)) {
        visibleNodeIds.add(l.source);
        visibleNodeIds.add(l.target);
      }
    }

    const visibleNodes = nodes.filter((n) => visibleNodeIds.has(n.id));
    const ln = [];
    for (const l of links) {
      if (!visibleNodeIds.has(l.source) || !visibleNodeIds.has(l.target)) continue;
      const s = p.get(l.source);
      const t = p.get(l.target);
      if (s && t) ln.push({ x1: s.x, y1: s.y, x2: t.x, y2: t.y, source: l.source, target: l.target });
    }

    const selectedNode = selectedId ? nodesById.get(selectedId) || null : null;
    const selectedNeighbors = selectedNode
      ? links
          .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
          .map((l) => nodesById.get(l.source === selectedNode.id ? l.target : l.source))
          .filter(Boolean)
      : [];

    const stats = {
      hosts: nodes.filter((n) => n.type === 'host').length,
      alerts: nodes.filter((n) => n.type === 'alert').length,
      links: links.length,
      visibleNodes: visibleNodes.length,
    };

    return { nodes: visibleNodes, links, pos: p, lines: ln, stats, selectedNode, selectedNeighbors };
  }, [data, search, typeFilter, severityFilter, selectedId]);

  function severityClass(severity) {
    const sev = normSeverity(severity);
    if (sev === 'critical') return styles.nodeCritical;
    if (sev === 'high') return styles.nodeHigh;
    if (sev === 'medium') return styles.nodeMedium;
    if (sev === 'low') return styles.nodeLow;
    return styles.nodeInfo;
  }

  return (
    <PageShell
      kicker="Explore"
      title="Threat graph"
      description="Analyst relationship map across hosts and detections, with severity-aware triage context."
      actions={
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={refresh}>
          Refresh
        </button>
      }
    >
      {err ? <p className={styles.err}>Failed: {err}</p> : null}
      <div className={styles.stats}>
        <div className={styles.statCard}><span>Hosts</span><strong>{stats.hosts}</strong></div>
        <div className={styles.statCard}><span>Alerts</span><strong>{stats.alerts}</strong></div>
        <div className={styles.statCard}><span>Relationships</span><strong>{stats.links}</strong></div>
        <div className={styles.statCard}><span>Visible</span><strong>{stats.visibleNodes}</strong></div>
      </div>

      <div className={styles.controls}>
        <input
          className={styles.input}
          placeholder="Search node label, id, severity"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All node types</option>
          <option value="host">Hosts only</option>
          <option value="alert">Alerts only</option>
        </select>
        <select className={styles.select} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div className={styles.layout}>
        <div className={styles.wrap}>
          <svg className={styles.svg} viewBox="0 0 1280 640" aria-label="Threat graph">
          {lines.map((l, i) => (
            <line
              key={`${l.source}-${l.target}-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className={`${styles.edge} ${selectedNode && (l.source === selectedNode.id || l.target === selectedNode.id) ? styles.edgeActive : ''}`}
            />
          ))}
          {nodes.map((n) => {
            const pt = pos.get(n.id);
            if (!pt) return null;
            const isHost = n.type === 'host';
            const isSelected = selectedNode?.id === n.id;
            return (
              <g key={n.id} transform={`translate(${pt.x}, ${pt.y})`} className={styles.nodeGroup} onClick={() => setSelectedId(n.id)}>
                <circle
                  r={isHost ? 14 : 11}
                  className={`${isHost ? styles.nodeHost : `${styles.nodeAlert} ${severityClass(n.meta?.severity)}`} ${isSelected ? styles.nodeSelected : ''}`}
                />
                <text y={isHost ? 32 : 28} textAnchor="middle" className={styles.label}>
                  {(n.label || n.id).slice(0, 28)}
                </text>
              </g>
            );
          })}
          </svg>
          {loading ? <div className={styles.loading}>Loading graph…</div> : null}
        </div>

        <aside className={styles.panel}>
          <h3>Entity details</h3>
          {!selectedNode ? (
            <p className={styles.muted}>Select a node to inspect details.</p>
          ) : (
            <>
              <div className={styles.kv}><span>Type</span><strong>{selectedNode.type}</strong></div>
              <div className={styles.kv}><span>Label</span><strong>{selectedNode.label || selectedNode.id}</strong></div>
              {selectedNode.meta?.severity ? (
                <div className={styles.kv}><span>Severity</span><strong>{normSeverity(selectedNode.meta.severity)}</strong></div>
              ) : null}
              {selectedNode.meta?.endpoint_id ? (
                <div className={styles.kv}><span>Endpoint</span><strong>{selectedNode.meta.endpoint_id}</strong></div>
              ) : null}
              {selectedNode.meta?.alert_id ? (
                <div className={styles.kv}><span>Alert</span><strong>{selectedNode.meta.alert_id}</strong></div>
              ) : null}

              <div className={styles.links}>
                {selectedNode.type === 'alert' ? (
                  <Link to="/alerts" className={styles.linkBtn}>Open detections</Link>
                ) : (
                  <Link to="/endpoints" className={styles.linkBtn}>Open endpoints</Link>
                )}
              </div>

              <h4>Connected entities ({selectedNeighbors.length})</h4>
              <div className={styles.neighbors}>
                {selectedNeighbors.slice(0, 16).map((n) => (
                  <button key={n.id} type="button" className={styles.neighbor} onClick={() => setSelectedId(n.id)}>
                    <span>{n.type}</span>
                    <strong>{n.label || n.id}</strong>
                  </button>
                ))}
                {selectedNeighbors.length === 0 ? <p className={styles.muted}>No direct relationships.</p> : null}
              </div>
            </>
          )}
        </aside>
      </div>

      <p className={styles.hint}>
        Host nodes are blue. Alert nodes are severity-colored (critical/high/medium/low/info). Click a node to inspect neighbors.
      </p>
    </PageShell>
  );
}
