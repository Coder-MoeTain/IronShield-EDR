import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import GeoWorldMap from '../components/GeoWorldMap';
import styles from './AgentNetworkMap.module.css';

/** Falcon-style scope for remote IPs (matches Network activity). */
function ipScopeLabel(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const a = addr.replace(/^::ffff:/i, '');
  if (a === '::1' || a.startsWith('127.')) return 'loopback';
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (!m) return null;
  const o = m.slice(1, 5).map((x) => parseInt(x, 10));
  if (o.some((n) => n > 255)) return null;
  const [b1, b2] = o;
  if (b1 === 10) return 'private';
  if (b1 === 172 && b2 >= 16 && b2 <= 31) return 'private';
  if (b1 === 192 && b2 === 168) return 'private';
  if (b1 === 100 && b2 >= 64 && b2 <= 127) return 'private';
  return 'public';
}

const MAX_REMOTES = 48;
const MAX_ENDPOINTS_RING = 16;
const FETCH_LIMIT = 400;

function hashToUnit(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 0..1 from relative traffic (connection count) on this graph; log spread when counts vary widely. */
function trafficNormLog(w, minW, maxW) {
  const lw = Math.log(Math.max(1, w));
  const lmin = Math.log(Math.max(1, minW));
  const lmax = Math.log(Math.max(1, maxW));
  if (lmax <= lmin) return 0.5;
  return Math.max(0, Math.min(1, (lw - lmin) / (lmax - lmin)));
}

/** Select values are strings; API may return endpoint_id as number — compare as strings. */
function sameEndpointId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/**
 * Build nodes/edges for canvas from connection rows.
 * Single-agent: agent center, remotes on a ring.
 * All agents: endpoints inner ring, remotes outer ring (capped).
 */
function buildGraph(connections, endpointFilter, hostById) {
  const rows = Array.isArray(connections) ? connections : [];
  const filtered = endpointFilter
    ? rows.filter((c) => sameEndpointId(c.endpoint_id, endpointFilter))
    : rows;

  const edgeWeights = new Map();
  const epLabels = new Map();

  for (const c of filtered) {
    const ep = c.endpoint_id;
    const rm = c.remote_address;
    if (ep == null || ep === '' || !rm) continue;
    const label = c.hostname || hostById.get(String(ep)) || String(ep).slice(0, 8);
    epLabels.set(String(ep), label);
    const k = `${ep}::${rm}`;
    edgeWeights.set(k, (edgeWeights.get(k) || 0) + 1);
  }

  const remoteTotals = new Map();
  for (const [k, w] of edgeWeights) {
    const rm = k.split('::')[1];
    remoteTotals.set(rm, (remoteTotals.get(rm) || 0) + w);
  }

  const remotesSorted = [...remoteTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_REMOTES)
    .map(([ip]) => ip);
  const remoteSet = new Set(remotesSorted);

  const prunedEdges = [];
  for (const [k, w] of edgeWeights) {
    const [ep, rm] = k.split('::');
    if (!remoteSet.has(rm)) continue;
    prunedEdges.push({ ep, rm, w });
  }

  const cappedRemotesTotal = remoteTotals.size > MAX_REMOTES;

  if (prunedEdges.length === 0) {
    return { nodes: [], links: [], singleAgent: !!endpointFilter, capped: { remotes: false, endpoints: false } };
  }

  const endpointIds = [...new Set(prunedEdges.map((e) => e.ep))];
  let endpointsUse = endpointIds;
  if (!endpointFilter && endpointIds.length > MAX_ENDPOINTS_RING) {
    const epWeight = new Map();
    for (const e of prunedEdges) {
      epWeight.set(e.ep, (epWeight.get(e.ep) || 0) + e.w);
    }
    endpointsUse = [...epWeight.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ENDPOINTS_RING)
      .map(([id]) => id);
    const epAllow = new Set(endpointsUse);
    let edges2 = prunedEdges.filter((e) => epAllow.has(e.ep));
    const remoteWeight2 = new Map();
    for (const e of edges2) {
      remoteWeight2.set(e.rm, (remoteWeight2.get(e.rm) || 0) + e.w);
    }
    const remotes2 = [...remoteWeight2.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_REMOTES)
      .map(([ip]) => ip);
    const rs = new Set(remotes2);
    edges2 = edges2.filter((e) => rs.has(e.rm));
    return finalizeGraph(edges2, endpointsUse, remotes2, epLabels, !!endpointFilter, {
      remotes: remoteWeight2.size > MAX_REMOTES,
      endpoints: true,
    });
  }

  return finalizeGraph(prunedEdges, endpointsUse, remotesSorted, epLabels, !!endpointFilter, {
    remotes: cappedRemotesTotal,
    endpoints: false,
  });
}

function finalizeGraph(prunedEdges, endpointIds, remotesSorted, epLabels, singleAgent, capped) {
  const epSet = new Set(endpointIds);
  const edges = prunedEdges.filter((e) => epSet.has(e.ep));

  const nodes = [];
  const nodeIndex = new Map();

  if (singleAgent && endpointIds.length === 1) {
    const id = endpointIds[0];
    nodes.push({ id: `ep:${id}`, kind: 'agent', key: id, label: epLabels.get(String(id)) || id, x: 0, y: 0 });
    nodeIndex.set(`ep:${id}`, 0);
    remotesSorted.forEach((rm, i) => {
      const ni = nodes.length;
      nodes.push({ id: `rm:${rm}`, kind: 'remote', key: rm, label: rm, x: 0, y: 0, ringIndex: i });
      nodeIndex.set(`rm:${rm}`, ni);
    });
  } else {
    endpointIds.forEach((id, i) => {
      const ni = nodes.length;
      nodes.push({ id: `ep:${id}`, kind: 'endpoint', key: id, label: epLabels.get(String(id)) || id, x: 0, y: 0, ringIndex: i });
      nodeIndex.set(`ep:${id}`, ni);
    });
    remotesSorted.forEach((rm, i) => {
      const ni = nodes.length;
      nodes.push({ id: `rm:${rm}`, kind: 'remote', key: rm, label: rm, x: 0, y: 0, ringIndex: i });
      nodeIndex.set(`rm:${rm}`, ni);
    });
  }

  const links = edges.map((e, i) => ({
    i,
    source: nodeIndex.get(`ep:${e.ep}`),
    target: nodeIndex.get(`rm:${e.rm}`),
    w: e.w,
  })).filter((l) => l.source != null && l.target != null);

  return { nodes, links, singleAgent, capped };
}

function layoutNodes(nodes, links, singleAgent, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) * 0.38;

  if (singleAgent && nodes.length && nodes[0].kind === 'agent') {
    nodes[0].x = cx;
    nodes[0].y = cy;
    const remotes = nodes.slice(1);
    const n = remotes.length;
    remotes.forEach((node, i) => {
      const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
      const r = R * (0.88 + 0.08 * hashToUnit(`${node.key}|off`));
      node.x = cx + Math.cos(a) * r;
      node.y = cy + Math.sin(a) * r;
    });
    return;
  }

  const eps = nodes.filter((n) => n.kind === 'endpoint');
  const rms = nodes.filter((n) => n.kind === 'remote');
  const nE = eps.length;
  const nR = rms.length;
  const r1 = R * 0.42;
  const r2 = R * 0.92;

  eps.forEach((node, i) => {
    const a = (2 * Math.PI * i) / Math.max(nE, 1) - Math.PI / 2;
    node.x = cx + Math.cos(a) * r1;
    node.y = cy + Math.sin(a) * r1;
  });

  rms.forEach((node, i) => {
    const jitter = hashToUnit(node.key) * 0.08;
    const a = (2 * Math.PI * i) / Math.max(nR, 1) - Math.PI / 2 + jitter;
    node.x = cx + Math.cos(a) * r2;
    node.y = cy + Math.sin(a) * r2;
  });
}

const DRAG_SMOOTH = 0.52;

/** Apply ring layout, then pinned positions, then smooth drag toward pointer target. */
function applyLayoutWithManual(nodes, links, singleAgent, width, height, manual, dragState, dragTarget) {
  layoutNodes(nodes, links, singleAgent, width, height);
  for (const node of nodes) {
    const o = manual.get(node.id);
    if (o) {
      node.x = o.x;
      node.y = o.y;
    }
  }
  if (dragState.active && dragState.nodeId) {
    const node = nodes.find((n) => n.id === dragState.nodeId);
    if (node && dragTarget && Number.isFinite(dragTarget.x)) {
      const nx = node.x + (dragTarget.x - node.x) * DRAG_SMOOTH;
      const ny = node.y + (dragTarget.y - node.y) * DRAG_SMOOTH;
      manual.set(dragState.nodeId, { x: nx, y: ny });
      node.x = nx;
      node.y = ny;
    }
  }
}

function clampPoint(x, y, w, h, pad) {
  return {
    x: Math.min(w - pad, Math.max(pad, x)),
    y: Math.min(h - pad, Math.max(pad, y)),
  };
}

export default function AgentNetworkMap() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [endpointId, setEndpointId] = useState(() => searchParams.get('endpointId') || '');
  const [hours, setHours] = useState(() => {
    const h = parseInt(searchParams.get('hours') || '24', 10);
    return [1, 6, 24, 168].includes(h) ? h : 24;
  });
  const [excludeLocalhost, setExcludeLocalhost] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [remoteFilter, setRemoteFilter] = useState(() => searchParams.get('remote') || '');
  const [processFilter, setProcessFilter] = useState(() => searchParams.get('process') || '');
  const [remoteDebounced, setRemoteDebounced] = useState(() => searchParams.get('remote') || '');
  const [processDebounced, setProcessDebounced] = useState(() => searchParams.get('process') || '');
  const [endpoints, setEndpoints] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [hover, setHover] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const iocIpSetRef = useRef(new Set());
  const [iocVersion, setIocVersion] = useState(0);
  const cameraRef = useRef({ scale: 1, panX: 0, panY: 0 });
  const panDragRef = useRef({ active: false, sx: 0, sy: 0, spx: 0, spy: 0 });
  const nodeDragMovedRef = useRef(false);
  const clickCandidateRef = useRef(null);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const animRef = useRef(0);
  const graphRef = useRef({ nodes: [], links: [] });
  const dimsRef = useRef({ w: 900, h: 560 });
  const manualPosRef = useRef(new Map());
  const dragStateRef = useRef({ active: false, nodeId: null, grabDx: 0, grabDy: 0 });
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  /** Browser fullscreen on the canvas wrapper only (not the whole page). */
  const [canvasFullscreen, setCanvasFullscreen] = useState(false);
  /** world = real map + geo arcs; graph = ring canvas */
  const [viewMode, setViewMode] = useState('world');
  const [worldFitSig, setWorldFitSig] = useState(0);

  const hostById = useMemo(() => {
    const m = new Map();
    for (const e of endpoints) {
      if (e?.id != null) m.set(String(e.id), e.hostname || e.id);
    }
    return m;
  }, [endpoints]);

  const graph = useMemo(
    () => buildGraph(connections, endpointId || null, hostById),
    [connections, endpointId, hostById]
  );

  const fetchConnections = useCallback(() => {
    const params = new URLSearchParams({ limit: String(FETCH_LIMIT), hours: String(hours) });
    if (endpointId) params.set('endpointId', endpointId);
    if (excludeLocalhost) params.set('excludeLocalhost', '1');
    if (remoteDebounced) params.set('remoteAddress', remoteDebounced);
    if (processDebounced) params.set('processName', processDebounced);
    return api(`/api/admin/network/connections?${params}`)
      .then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      })
      .then(setConnections)
      .catch(() => setConnections([]));
  }, [api, hours, endpointId, excludeLocalhost, remoteDebounced, processDebounced]);

  const fetchKpi = useCallback(() => {
    const params = new URLSearchParams({ hours: String(hours) });
    if (endpointId) params.set('endpointId', endpointId);
    if (excludeLocalhost) params.set('excludeLocalhost', '1');
    return api(`/api/admin/network/summary?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setKpi(d && typeof d === 'object' ? d : null))
      .catch(() => setKpi(null));
  }, [api, hours, endpointId, excludeLocalhost]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadErr(null);
    fetchKpi();
    fetchConnections()
      .catch(() => setLoadErr('Could not load connection rows'))
      .finally(() => setLoading(false));
  }, [fetchConnections, fetchKpi]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const reduceMotionRef = useRef(false);
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    api('/api/admin/iocs')
      .then((r) => r.json())
      .then((rows) => {
        const s = new Set();
        for (const row of Array.isArray(rows) ? rows : []) {
          if (String(row.ioc_type || '').toLowerCase() === 'ip' && row.ioc_value) {
            s.add(String(row.ioc_value).trim().toLowerCase());
          }
        }
        iocIpSetRef.current = s;
        setIocVersion((v) => v + 1);
      })
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('hours', String(hours));
      if (remoteFilter.trim()) p.set('remote', remoteFilter.trim());
      else p.delete('remote');
      if (processFilter.trim()) p.set('process', processFilter.trim());
      else p.delete('process');
      return p;
    });
  }, [hours, remoteFilter, processFilter, setSearchParams]);

  useEffect(() => {
    const t = setTimeout(() => setRemoteDebounced(remoteFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [remoteFilter]);

  useEffect(() => {
    const t = setTimeout(() => setProcessDebounced(processFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [processFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  /** Sync UI when entering/exiting canvas fullscreen (incl. Esc); re-measure canvas / Leaflet map. */
  useEffect(() => {
    const sync = () => {
      const el = wrapRef.current;
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      const fs = !!el && active === el;
      setCanvasFullscreen(fs);
      if (fs) {
        setWorldFitSig((s) => s + 1);
      }
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleCanvasFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      if (active === el) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch (e) {
      console.warn('Canvas fullscreen:', e);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }, [loading]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : d?.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [api]);

  const onEndpointChange = (v) => {
    setEndpointId(v);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (v) p.set('endpointId', v);
      else p.delete('endpointId');
      return p;
    });
  };

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  /** Keep manual drag positions when filters/data change; only drop positions for nodes no longer in the graph. */
  useEffect(() => {
    const ids = new Set((graph.nodes || []).map((n) => n.id));
    const manual = manualPosRef.current;
    for (const key of [...manual.keys()]) {
      if (!ids.has(key)) manual.delete(key);
    }
    if (
      dragStateRef.current.active &&
      dragStateRef.current.nodeId &&
      !ids.has(dragStateRef.current.nodeId)
    ) {
      dragStateRef.current = { active: false, nodeId: null, grabDx: 0, grabDy: 0 };
      setIsDragging(false);
    }
  }, [graph]);

  const pickNodeAt = useCallback((mx, my) => {
    const g = graphRef.current;
    const nodes = g.nodes || [];
    if (nodes.length === 0) return null;
    const { w, h } = dimsRef.current;
    const cam = cameraRef.current;
    const wx = (mx - cam.panX) / cam.scale;
    const wy = (my - cam.panY) / cam.scale;
    applyLayoutWithManual(
      nodes,
      g.links || [],
      g.singleAgent,
      w,
      h,
      manualPosRef.current,
      { active: false, nodeId: null, grabDx: 0, grabDy: 0 },
      { x: Number.NaN, y: Number.NaN }
    );
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const n = nodes[i];
      const dist = Math.hypot(wx - n.x, wy - n.y);
      const hitR = n.kind === 'agent' ? 22 : n.kind === 'endpoint' ? 18 : 14;
      if (dist <= hitR) return n;
    }
    return null;
  }, []);

  const resetLayout = useCallback(() => {
    manualPosRef.current.clear();
    dragStateRef.current = { active: false, nodeId: null, grabDx: 0, grabDy: 0 };
    cameraRef.current = { scale: 1, panX: 0, panY: 0 };
    setIsDragging(false);
  }, []);

  const fitCameraToGraph = useCallback(() => {
    if (viewMode === 'world') {
      setWorldFitSig((s) => s + 1);
      return;
    }
    const g = graphRef.current;
    const nodes = g.nodes || [];
    const { w, h } = dimsRef.current;
    if (!nodes.length || !w || !h) return;
    applyLayoutWithManual(
      nodes,
      g.links || [],
      g.singleAgent,
      w,
      h,
      manualPosRef.current,
      { active: false, nodeId: null, grabDx: 0, grabDy: 0 },
      { x: Number.NaN, y: Number.NaN }
    );
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const pad = 48;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - pad);
      minY = Math.min(minY, n.y - pad);
      maxX = Math.max(maxX, n.x + pad);
      maxY = Math.max(maxY, n.y + pad);
    }
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const scale = Math.min((0.92 * w) / bw, (0.92 * h) / bh, 4);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    cameraRef.current.scale = scale;
    cameraRef.current.panX = w / 2 - cx * scale;
    cameraRef.current.panY = h / 2 - cy * scale;
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'graph') return undefined;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const resize = () => {
      /* Measure the wrapper — canvas height:100% can report 0 or wrong size before flex/parent resolves. */
      const wrapRect = wrap.getBoundingClientRect();
      const w = Math.max(320, wrapRect.width);
      let h = wrapRect.height;
      if (!Number.isFinite(h) || h < 48) {
        h = Math.min(Math.max(360, window.innerHeight * 0.55), 640);
      } else {
        h = Math.max(200, h);
      }
      dimsRef.current = { w, h };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d');
    let t0 = performance.now();

    const draw = (t) => {
      const elapsed = (t - t0) / 1000;
      const { w, h } = dimsRef.current;
      const dpr = window.devicePixelRatio || 1;
      const g = graphRef.current;
      const nodes = g.nodes || [];
      const links = g.links || [];

      applyLayoutWithManual(
        nodes,
        links,
        g.singleAgent,
        w,
        h,
        manualPosRef.current,
        dragStateRef.current,
        dragTargetRef.current
      );

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.65);
      grd.addColorStop(0, 'rgba(8, 32, 64, 0.5)');
      grd.addColorStop(0.45, 'rgba(3, 10, 24, 0.85)');
      grd.addColorStop(1, '#02060f');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      const cam = cameraRef.current;
      const rm = reduceMotionRef.current;
      ctx.save();
      ctx.translate(cam.panX, cam.panY);
      ctx.scale(cam.scale, cam.scale);

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.06)';
      ctx.lineWidth = 1;
      const grid = 48;
      for (let x = 0; x < w; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.1)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      let minLw = Infinity;
      let maxLw = -Infinity;
      for (const L of links) {
        const wi = Math.max(1, Number(L.w) || 1);
        if (wi < minLw) minLw = wi;
        if (wi > maxLw) maxLw = wi;
      }
      if (!Number.isFinite(minLw) || links.length === 0) {
        minLw = 1;
        maxLw = 1;
      }

      for (const L of links) {
        const a = nodes[L.source];
        const b = nodes[L.target];
        if (!a || !b) continue;
        const wCount = Math.max(1, Number(L.w) || 1);
        const norm = trafficNormLog(wCount, minLw, maxLw);
        const pulse = rm ? 0.65 : 0.5 + 0.5 * Math.sin(elapsed * 2.2 + L.i * 0.15);
        const r = Math.round(lerp(52, 190, norm));
        const gch = Math.round(lerp(110, 255, norm));
        const bch = Math.round(lerp(165, 255, norm));
        const baseA = lerp(0.12, 0.5, norm);
        const pulseA = pulse * lerp(0.08, 0.28, norm);
        ctx.strokeStyle = `rgba(${r},${gch},${bch},${Math.min(0.92, baseA + pulseA)})`;
        ctx.lineWidth = lerp(0.45, 5.5, norm) + Math.min(1.2, wCount / 35);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const flow = rm ? 0.35 : (elapsed * 0.55 + L.i * 0.07) % 1;
        const px = a.x + ux * len * flow;
        const py = a.y + uy * len * flow;
        const pr = lerp(1.6, 3.1, norm);
        ctx.fillStyle = `rgba(${Math.round(lerp(140, 220, norm))},${Math.round(lerp(160, 255, norm))},${Math.round(lerp(255, 255, norm))},${lerp(0.55, 0.98, norm)})`;
        if (!rm) {
          ctx.shadowColor = `rgba(${r},${gch},${bch},${0.5 + norm * 0.45})`;
          ctx.shadowBlur = lerp(4, 12, norm);
        }
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        const flow2 = rm ? 0.72 : (flow + 0.37) % 1;
        const px2 = a.x + ux * len * flow2;
        const py2 = a.y + uy * len * flow2;
        const pr2 = lerp(1.2, 2.4, norm);
        ctx.fillStyle = `rgba(${Math.round(lerp(34, 120, norm))},${Math.round(lerp(200, 240, norm))},${Math.round(lerp(238, 255, norm))},${lerp(0.45, 0.92, norm)})`;
        ctx.beginPath();
        ctx.arc(px2, py2, pr2, 0, Math.PI * 2);
        ctx.fill();
      }

      const iocSet = iocIpSetRef.current;
      for (const node of nodes) {
        const isAgent = node.kind === 'agent' || node.kind === 'endpoint';
        const radius = isAgent ? (node.kind === 'agent' ? 14 : 11) : 7;
        const pulse = rm ? 1 : 1 + 0.06 * Math.sin(elapsed * 3 + hashToUnit(node.id) * 6);
        const r = radius * pulse;
        const isIocRemote = node.kind === 'remote' && iocSet.has(String(node.key).toLowerCase());

        if (isIocRemote) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = isAgent ? 'rgba(34, 211, 238, 0.12)' : 'rgba(167, 139, 250, 0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const nodeGrd = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
        if (isAgent) {
          nodeGrd.addColorStop(0, '#67e8f9');
          nodeGrd.addColorStop(1, '#0891b2');
        } else {
          nodeGrd.addColorStop(0, '#c4b5fd');
          nodeGrd.addColorStop(1, '#6d28d9');
        }
        ctx.fillStyle = nodeGrd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const label = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label;
        ctx.font = isAgent ? '600 11px ui-sans-serif, system-ui, sans-serif' : '10px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(224, 242, 254, 0.88)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, node.x, node.y - r - 6);
      }

      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [viewMode]);

  const onCanvasPointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { w, h } = dimsRef.current;
    const cam = cameraRef.current;
    const wx = (mx - cam.panX) / cam.scale;
    const wy = (my - cam.panY) / cam.scale;

    if (panDragRef.current.active) {
      const p = panDragRef.current;
      cam.panX = p.spx + (mx - p.sx);
      cam.panY = p.spy + (my - p.sy);
      return;
    }

    if (dragStateRef.current.active) {
      const { grabDx, grabDy } = dragStateRef.current;
      dragTargetRef.current = clampPoint(wx - grabDx, wy - grabDy, w, h, 20);
      const cc = clickCandidateRef.current;
      if (cc && (Math.abs(mx - cc.mx) > 6 || Math.abs(my - cc.my) > 6)) nodeDragMovedRef.current = true;
      return;
    }

    const n = pickNodeAt(mx, my);
    if (n) {
      const scope = n.kind === 'remote' ? ipScopeLabel(n.key) : null;
      const ioc = n.kind === 'remote' && iocIpSetRef.current.has(String(n.key).toLowerCase());
      setHover({
        x: mx,
        y: my,
        text:
          n.kind === 'remote'
            ? `Remote ${n.label}${scope ? ` · ${scope}` : ''}${ioc ? ' · IOC watchlist' : ''} · drag · click details`
            : `${n.kind === 'agent' ? 'Agent' : 'Host'} · ${n.label} · drag · click details`,
      });
    } else {
      setHover(null);
    }
  };

  const onCanvasPointerDown = (e) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cam = cameraRef.current;
    const wx = (mx - cam.panX) / cam.scale;
    const wy = (my - cam.panY) / cam.scale;
    const n = pickNodeAt(mx, my);
    if (!n) {
      panDragRef.current = { active: true, sx: mx, sy: my, spx: cam.panX, spy: cam.panY };
      setHover(null);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    manualPosRef.current.set(n.id, { x: n.x, y: n.y });
    dragStateRef.current = {
      active: true,
      nodeId: n.id,
      grabDx: wx - n.x,
      grabDy: wy - n.y,
    };
    dragTargetRef.current = { x: n.x, y: n.y };
    nodeDragMovedRef.current = false;
    clickCandidateRef.current = { id: n.id, mx, my };
    setIsDragging(true);
    setHover(null);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const endDrag = (e) => {
    const canvas = canvasRef.current;
    if (panDragRef.current.active && canvas && e?.pointerId != null) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    panDragRef.current = { active: false, sx: 0, sy: 0, spx: 0, spy: 0 };
    if (dragStateRef.current.active && canvas && e?.pointerId != null) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const wasNodeDrag = dragStateRef.current.active;
    const cand = clickCandidateRef.current;
    const moved = nodeDragMovedRef.current;
    dragStateRef.current = { active: false, nodeId: null, grabDx: 0, grabDy: 0 };
    clickCandidateRef.current = null;
    setIsDragging(false);
    if (wasNodeDrag && cand && !moved) {
      const g = graphRef.current;
      const node = (g.nodes || []).find((x) => x.id === cand.id);
      if (node) setSelectedNode(node);
    }
  };

  const onCanvasPointerUp = (e) => {
    endDrag(e);
  };

  const onCanvasWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cam = cameraRef.current;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(4, Math.max(0.2, cam.scale * factor));
    const worldX = (mx - cam.panX) / cam.scale;
    const worldY = (my - cam.panY) / cam.scale;
    cam.panX = mx - worldX * newScale;
    cam.panY = my - worldY * newScale;
    cam.scale = newScale;
  };

  const onCanvasPointerLeave = () => {
    if (!dragStateRef.current.active) setHover(null);
  };

  const stats = useMemo(() => {
    const n = graph.nodes?.length || 0;
    const e = graph.links?.length || 0;
    const cap = graph.capped ?? { remotes: false, endpoints: false };
    return { n, e, cap };
  }, [graph]);

  const selectedDetail = useMemo(() => {
    if (!selectedNode) return null;
    const rows = connections;
    if (selectedNode.kind === 'remote') {
      const ip = selectedNode.key;
      const related = rows.filter((r) => String(r.remote_address) === String(ip));
      const procs = [...new Set(related.map((r) => r.process_name).filter(Boolean))];
      return {
        type: 'remote',
        ip,
        scope: ipScopeLabel(ip),
        ioc: iocIpSetRef.current.has(String(ip).toLowerCase()),
        procs,
        edges: related.length,
      };
    }
    const ep = selectedNode.key;
    const related = rows.filter((r) => String(r.endpoint_id) === String(ep));
    return {
      type: 'host',
      endpointId: ep,
      hostname: selectedNode.label,
      edges: related.length,
    };
  }, [selectedNode, connections, iocVersion]);

  const exportPng = useCallback(() => {
    if (viewMode === 'world') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'ironshield-agent-network-map.png';
    a.click();
  }, [viewMode]);

  const copySummary = useCallback(async () => {
    const g = graph;
    const cap = g.capped || { remotes: false, endpoints: false };
    const lines = [
      'IronShield — Agent network map',
      `Window: ${hours}h · Endpoint: ${endpointId || 'all'}`,
      `Nodes: ${g.nodes?.length ?? 0} · Links: ${g.links?.length ?? 0}`,
      cap.remotes || cap.endpoints
        ? `Sampled graph: ${cap.remotes ? `top ${MAX_REMOTES} remotes` : ''}${cap.remotes && cap.endpoints ? '; ' : ''}${cap.endpoints ? `top ${MAX_ENDPOINTS_RING} hosts` : ''}`
        : 'Full graph within caps',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      /* ignore */
    }
  }, [graph, hours, endpointId]);

  const onCanvasDoubleClick = useCallback(
    (e) => {
      e.preventDefault();
      fitCameraToGraph();
    },
    [fitCameraToGraph]
  );

  return (
    <PageShell
      kicker="Advanced"
      title="Agent network map"
      actions={
        <div className={styles.actionsBar}>
          <button
            type="button"
            className={`${styles.cyberBtn} ${styles.mapViewToggle}`}
            onClick={toggleCanvasFullscreen}
            aria-pressed={canvasFullscreen}
            title={
              canvasFullscreen
                ? 'Exit fullscreen (graph only) — or press Esc'
                : 'Fullscreen the graph canvas only (not the whole page)'
            }
          >
            <span className={styles.mapViewToggleIcon} aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M20 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className={styles.mapViewToggleText}>
              <span className={styles.mapViewToggleLabel}>{canvasFullscreen ? 'Exit full screen' : 'Full screen'}</span>
              <span className={styles.mapViewToggleHint}>
                {canvasFullscreen ? 'Esc to exit' : 'Canvas only'}
              </span>
            </span>
          </button>
          <div className={styles.viewModeBar} role="group" aria-label="Visualization mode">
            <button
              type="button"
              className={`${styles.cyberBtn} ${viewMode === 'world' ? styles.viewModeActive : ''}`}
              onClick={() => setViewMode('world')}
              aria-pressed={viewMode === 'world'}
              title="Real world map — traffic arcs to remote countries (GeoLite)"
            >
              World map
            </button>
            <button
              type="button"
              className={`${styles.cyberBtn} ${viewMode === 'graph' ? styles.viewModeActive : ''}`}
              onClick={() => setViewMode('graph')}
              aria-pressed={viewMode === 'graph'}
              title="Ring layout graph"
            >
              Ring graph
            </button>
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={autoRefresh} onChange={(ev) => setAutoRefresh(ev.target.checked)} />
            Live refresh
          </label>
          <label className={styles.toggle}>
            <input type="checkbox" checked={excludeLocalhost} onChange={(ev) => setExcludeLocalhost(ev.target.checked)} />
            Exclude localhost
          </label>
          <select
            className={styles.select}
            value={endpointId}
            onChange={(ev) => onEndpointChange(ev.target.value)}
            aria-label="Filter by agent"
          >
            <option value="">All agents</option>
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.hostname || ep.id}
              </option>
            ))}
          </select>
          <select className={styles.select} value={hours} onChange={(ev) => setHours(Number(ev.target.value))}>
            <option value={1}>Last 1h</option>
            <option value={6}>Last 6h</option>
            <option value={24}>Last 24h</option>
            <option value={168}>Last 7d</option>
          </select>
          <button type="button" onClick={load} className={styles.cyberBtn}>
            Refresh
          </button>
          <Link to="/network" className={styles.cyberBtn}>
            Network tables
          </Link>
          <button type="button" className={styles.cyberBtn} onClick={fitCameraToGraph} title="Zoom and pan to fit all nodes">
            Fit view
          </button>
          <button type="button" className={styles.cyberBtn} onClick={exportPng} title="Download map as PNG">
            Export PNG
          </button>
          <button type="button" className={styles.cyberBtn} onClick={copySummary} title="Copy map stats to clipboard">
            Copy summary
          </button>
        </div>
      }
    >
      <div className={styles.pageRoot}>
        {loadErr ? (
          <div className={styles.liveErr} role="alert" aria-live="polite">
            {loadErr}
          </div>
        ) : null}
        <div className={styles.kpiStrip} role="region" aria-label="Network window KPIs">
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Connections</span>
            <strong className={styles.kpiVal}>{(kpi?.total_connections ?? 0).toLocaleString()}</strong>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Unique remotes</span>
            <strong className={styles.kpiVal}>{(kpi?.unique_remote_ips ?? 0).toLocaleString()}</strong>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Hosts w/ activity</span>
            <strong className={styles.kpiVal}>{(kpi?.hosts_with_activity ?? 0).toLocaleString()}</strong>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Destinations</span>
            <strong className={styles.kpiVal}>{(kpi?.outgoing_destinations ?? 0).toLocaleString()}</strong>
          </div>
        </div>
        <div className={styles.filterRow}>
          <label className={styles.filterLabel}>
            Remote IP
            <input
              type="search"
              className={styles.filterInput}
              value={remoteFilter}
              onChange={(ev) => setRemoteFilter(ev.target.value)}
              placeholder="Contains…"
              aria-label="Filter remote IP contains"
            />
          </label>
          <label className={styles.filterLabel}>
            Process
            <input
              type="search"
              className={styles.filterInput}
              value={processFilter}
              onChange={(ev) => setProcessFilter(ev.target.value)}
              placeholder="Name contains…"
              aria-label="Filter process name contains"
            />
          </label>
          <span className={styles.filterHint}>Filters apply after a short debounce (same API as Network tables).</span>
        </div>
        {(stats.cap?.remotes || stats.cap?.endpoints) && (
          <p className={styles.capNotice} role="status">
            Graph shows a sampled subset:{' '}
            {stats.cap.remotes ? (
              <span>
                top <strong>{MAX_REMOTES}</strong> remote IPs by volume
              </span>
            ) : null}
            {stats.cap.remotes && stats.cap.endpoints ? ' · ' : null}
            {stats.cap.endpoints ? (
              <span>
                top <strong>{MAX_ENDPOINTS_RING}</strong> hosts by volume
              </span>
            ) : null}
            . Narrow time range or filter by agent for a fuller picture.
          </p>
        )}
        <div className={styles.canvasWrap} ref={wrapRef}>
          {viewMode === 'world' ? (
            <GeoWorldMap
              api={api}
              connections={connections}
              endpoints={endpoints}
              fitSignal={worldFitSig}
              fullscreen={canvasFullscreen}
              className={styles.geoWorldFill}
            />
          ) : (
            <>
              <canvas
                ref={canvasRef}
                className={`${styles.canvas} ${isDragging ? styles.canvasDragging : ''}`}
                onPointerMove={onCanvasPointerMove}
                onPointerDown={onCanvasPointerDown}
                onPointerUp={onCanvasPointerUp}
                onPointerCancel={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerLeave}
                onWheel={onCanvasWheel}
                onDoubleClick={onCanvasDoubleClick}
              />
              {loading && (
                <div className={styles.skeletonOverlay} role="status" aria-busy="true">
                  <div className={styles.skeletonPulse} />
                  <span>Syncing telemetry…</span>
                </div>
              )}
              {!loading && stats.n === 0 && (
                <div className={styles.emptyHint}>No connection rows for this window. Try another time range or clear the agent filter.</div>
              )}
              {hover && (
                <div
                  className={styles.tooltip}
                  style={{ left: Math.min(hover.x + 12, (wrapRef.current?.clientWidth || 400) - 140), top: hover.y + 12 }}
                >
                  {hover.text}
                </div>
              )}
            </>
          )}
          {viewMode === 'world' && loading && (
            <div className={styles.skeletonOverlay} role="status" aria-busy="true">
              <div className={styles.skeletonPulse} />
              <span>Syncing telemetry…</span>
            </div>
          )}
          {viewMode === 'world' && !loading && stats.n === 0 && (
            <div className={styles.emptyHint}>No connection rows for this window. Try another time range or clear the agent filter.</div>
          )}
        </div>
        <div className={styles.statsRow}>
          <span>
            Nodes: <strong>{stats.n}</strong>
          </span>
          <span>
            Links: <strong>{stats.e}</strong>
          </span>
          <span>
            Mode: <strong>{graph.singleAgent ? 'Single agent' : 'Fleet'}</strong>
          </span>
          <button type="button" className={styles.cyberBtnSmall} onClick={resetLayout}>
            Reset layout
          </button>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ color: '#22d3ee', background: '#22d3ee' }} />
              Agent / host
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ color: '#a78bfa', background: '#a78bfa' }} />
              Remote IP
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ color: '#fbbf24', background: '#fbbf24' }} />
              IOC watchlist IP
            </span>
          </div>
        </div>
        {selectedNode && selectedDetail ? (
          <aside className={styles.detailPanel} role="dialog" aria-label="Node details" aria-modal="false">
            <div className={styles.detailHead}>
              <h2 className={styles.detailTitle}>
                {selectedDetail.type === 'remote' ? 'Remote IP' : 'Host'}
              </h2>
              <button
                type="button"
                className={styles.detailClose}
                onClick={() => setSelectedNode(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>
            {selectedDetail.type === 'remote' ? (
              <div className={styles.detailBody}>
                <p className={styles.detailMono}>{selectedDetail.ip}</p>
                {selectedDetail.scope ? (
                  <span
                    className={`${styles.scopeBadge} ${
                      selectedDetail.scope === 'private'
                        ? styles.scope_private
                        : selectedDetail.scope === 'public'
                          ? styles.scope_public
                          : selectedDetail.scope === 'loopback'
                            ? styles.scope_loopback
                            : ''
                    }`}
                  >
                    {selectedDetail.scope}
                  </span>
                ) : null}
                {selectedDetail.ioc ? <span className={styles.iocBadge}>IOC watchlist</span> : null}
                <p className={styles.detailMeta}>
                  Rows in window: <strong>{selectedDetail.edges}</strong>
                </p>
                {selectedDetail.procs.length > 0 ? (
                  <div>
                    <div className={styles.detailSub}>Processes seen</div>
                    <ul className={styles.procList}>
                      {selectedDetail.procs.slice(0, 12).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Link
                  className={styles.detailLink}
                  to={`/network?hours=${hours}&remoteAddress=${encodeURIComponent(selectedDetail.ip)}`}
                >
                  Open in Network activity →
                </Link>
              </div>
            ) : (
              <div className={styles.detailBody}>
                <p className={styles.detailStrong}>{selectedDetail.hostname}</p>
                <p className={styles.detailMeta}>
                  Endpoint ID <span className={styles.detailMono}>{selectedDetail.endpointId}</span> · Rows:{' '}
                  <strong>{selectedDetail.edges}</strong>
                </p>
                <Link
                  className={styles.detailLink}
                  to={`/network?endpointId=${encodeURIComponent(selectedDetail.endpointId)}&hours=${hours}`}
                >
                  Open in Network activity →
                </Link>
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </PageShell>
  );
}
