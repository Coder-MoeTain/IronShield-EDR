import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { greatCircleArc, trafficNorm, lerp } from '../utils/geoArc';
import styles from './GeoWorldMap.module.css';
import 'leaflet/dist/leaflet.css';

/** Fallback when agent public IP is private / not in GeoLite — arcs start here (Myanmar). */
const DEFAULT_ORIGIN = { lat: 21.9162, lng: 95.956 };
const MAX_EDGES = 90;

function normIp(ip) {
  if (!ip) return '';
  return String(ip).replace(/^::ffff:/i, '').trim();
}

/** ISO 3166-1 alpha-2 → regional-indicator flag emoji (offline, no CDN). */
function flagEmoji(iso2) {
  if (!iso2 || typeof iso2 !== 'string') return '';
  const u = iso2.trim().toUpperCase();
  if (u.length !== 2 || !/^[A-Z]{2}$/.test(u)) return '';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + u.charCodeAt(0) - 65, A + u.charCodeAt(1) - 65);
}

function countryDisplayName(iso2) {
  if (!iso2 || typeof iso2 !== 'string') return '';
  const u = iso2.trim().toUpperCase();
  if (u.length !== 2) return iso2;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(u) || iso2;
  } catch {
    return iso2;
  }
}

function FitBounds({ boundsKey, points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length < 1) return;
    if (points.length === 1) {
      map.setView(points[0], 4);
      return;
    }
    const b = L.latLngBounds(points.map((p) => [p[0], p[1]]));
    if (b.isValid()) {
      map.fitBounds(b, { padding: [36, 36], maxZoom: 6, animate: true });
    }
  }, [map, boundsKey, points]);
  return null;
}

/** Leaflet needs this after container resize / fullscreen */
function MapInvalidate({ rev }) {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize({ animate: false });
    run();
    const t = setTimeout(run, 200);
    window.addEventListener('resize', run);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', run);
    };
  }, [map, rev]);
  return null;
}

/**
 * Real-world traffic map: arcs from agent (endpoint public IP) toward geolocated remote countries.
 */
export default function GeoWorldMap({
  api,
  connections,
  endpoints,
  compact = false,
  fullscreen = false,
  fitSignal = 0,
  className = '',
}) {
  const [geoRows, setGeoRows] = useState([]);
  const [geoErr, setGeoErr] = useState(null);

  const ipsNeeded = useMemo(() => {
    const s = new Set();
    for (const c of connections || []) {
      if (c.remote_address) s.add(normIp(c.remote_address));
      const ep = (endpoints || []).find((e) => String(e.id) === String(c.endpoint_id));
      if (ep?.ip_address) s.add(normIp(ep.ip_address));
    }
    return [...s].filter(Boolean);
  }, [connections, endpoints]);

  const loadGeo = useCallback(() => {
    if (ipsNeeded.length === 0) {
      setGeoRows([]);
      return;
    }
    setGeoErr(null);
    api('/api/admin/network/geo-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ips: ipsNeeded }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setGeoRows(Array.isArray(d.results) ? d.results : []))
      .catch((e) => {
        setGeoErr(e?.message || 'Geo lookup failed');
        setGeoRows([]);
      });
  }, [api, ipsNeeded]);

  useEffect(() => {
    loadGeo();
  }, [loadGeo]);

  const geoByIp = useMemo(() => {
    const m = new Map();
    for (const r of geoRows) {
      if (r.lat != null && r.lng != null) m.set(normIp(r.ip), r);
    }
    return m;
  }, [geoRows]);

  const edges = useMemo(() => {
    const list = [];
    const agg = new Map();
    for (const c of connections || []) {
      const ep = c.endpoint_id;
      const rm = c.remote_address;
      if (ep == null || !rm) continue;
      const k = `${ep}::${rm}`;
      const add = Math.max(1, Number(c.w) || 1);
      agg.set(k, (agg.get(k) || 0) + add);
    }
    const epById = new Map((endpoints || []).map((e) => [String(e.id), e]));
    for (const [k, w] of agg) {
      const [epId, remoteIp] = k.split('::');
      const ep = epById.get(String(epId));
      const hostIp = ep?.ip_address ? normIp(ep.ip_address) : null;
      const from = hostIp ? geoByIp.get(hostIp) : null;
      const to = geoByIp.get(normIp(remoteIp));
      if (!to) continue;
      const fromLat = from?.lat ?? DEFAULT_ORIGIN.lat;
      const fromLng = from?.lng ?? DEFAULT_ORIGIN.lng;
      const toLat = to.lat;
      const toLng = to.lng;
      const toCc = (to.countryCode || to.country || '').trim() || null;
      const fromCc = from ? (from.countryCode || from.country || '').trim() || null : null;
      list.push({
        key: k,
        w,
        fromLat,
        fromLng,
        toLat,
        toLng,
        remoteIp,
        country: to.country || to.countryCode || '—',
        countryCode: toCc,
        hostCountryCode: fromCc,
        hostname: ep?.hostname || epId,
        fromResolved: !!from,
      });
    }
    list.sort((a, b) => b.w - a.w);
    return list.slice(0, MAX_EDGES);
  }, [connections, endpoints, geoByIp]);

  const weightRange = useMemo(() => {
    const ws = edges.map((e) => e.w);
    if (ws.length === 0) return { minW: 1, maxW: 1 };
    return { minW: Math.min(...ws), maxW: Math.max(...ws) };
  }, [edges]);

  const boundsPoints = useMemo(() => {
    const pts = [];
    for (const e of edges) {
      pts.push([e.fromLat, e.fromLng], [e.toLat, e.toLng]);
    }
    return pts;
  }, [edges]);

  const remoteMarkers = useMemo(() => {
    const m = new Map();
    for (const e of edges) {
      const k = `${e.toLat},${e.toLng},${e.remoteIp}`;
      if (!m.has(k)) {
        m.set(k, {
          lat: e.toLat,
          lng: e.toLng,
          ip: e.remoteIp,
          country: e.country,
          countryCode: e.countryCode,
          weight: e.w,
        });
      } else {
        const o = m.get(k);
        o.weight += e.w;
      }
    }
    return [...m.values()];
  }, [edges]);

  const h = compact ? 260 : fullscreen ? '100%' : 'min(62vh, 640px)';

  return (
    <div
      className={`${styles.wrap} ${compact ? styles.compact : ''} ${fullscreen ? styles.fullscreen : ''} ${className}`.trim()}
      style={{
        minHeight: typeof h === 'number' ? h : undefined,
        height: compact ? undefined : fullscreen ? '100%' : '100%',
      }}
    >
      {geoErr ? (
        <div className={styles.bannerErr} role="alert">
          {geoErr}
        </div>
      ) : null}
      <MapContainer
        center={[DEFAULT_ORIGIN.lat, DEFAULT_ORIGIN.lng]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        scrollWheelZoom
        className={styles.map}
        style={{
          height: typeof h === 'number' ? `${h}px` : h,
          width: '100%',
          flex: fullscreen ? '1 1 auto' : undefined,
          minHeight: fullscreen ? 0 : undefined,
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapInvalidate rev={`${fitSignal}-${edges.length}-${geoRows.length}-${fullscreen ? 1 : 0}`} />
        <FitBounds boundsKey={fitSignal} points={boundsPoints} />

        {edges.map((e, idx) => {
          const norm = trafficNorm(e.w, weightRange.minW, weightRange.maxW);
          const sw = lerp(1.2, 4.5, norm);
          const op = lerp(0.25, 0.75, norm);
          const positions = greatCircleArc(e.fromLat, e.fromLng, e.toLat, e.toLng);
          const stagger = idx % 8;
          return (
            <React.Fragment key={e.key}>
              {/* Glow underlay — wider, softer, opposite dash phase */}
              {/* className must be a top-level prop: Leaflet only applies it in _initPath; pathOptions-only className is merged later and never updates the DOM class. */}
              <Polyline
                positions={positions}
                className={`geoTrafficGlow geoTrafficGlow--${stagger}`}
                pathOptions={{
                  color: '#67e8f9',
                  weight: sw + 2.2,
                  opacity: lerp(0.06, 0.2, norm),
                  lineCap: 'round',
                }}
              />
              <Polyline
                positions={positions}
                className={`geoTrafficArc geoTrafficArc--${stagger}`}
                pathOptions={{
                  color: '#22d3ee',
                  weight: sw,
                  opacity: op,
                  lineCap: 'round',
                }}
              />
            </React.Fragment>
          );
        })}

        {(endpoints || [])
          .filter((ep) => (connections || []).some((c) => String(c.endpoint_id) === String(ep.id)))
          .map((ep) => {
          const ip = ep.ip_address ? normIp(ep.ip_address) : null;
          const g = ip ? geoByIp.get(ip) : null;
          if (!g) return null;
          const hostCc = (g.countryCode || g.country || '').trim() || null;
          const hostFlag = flagEmoji(hostCc);
          const hostCountryLabel = hostCc ? countryDisplayName(hostCc) : '';
          return (
            <CircleMarker key={`ep-${ep.id}`} center={[g.lat, g.lng]} radius={compact ? 5 : 7} pathOptions={{ color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 0.85, weight: 2 }}>
              <Tooltip
                permanent={!compact}
                direction="top"
                offset={[0, compact ? -6 : -8]}
                className={styles.markerTooltip}
              >
                <span className={styles.tooltipFlag}>{hostFlag ? `${hostFlag} ` : ''}</span>
                <span className={styles.tooltipTitle}>{ep.hostname || 'Host'}</span>
                <br />
                <span className={styles.mono}>{ip}</span>
                {hostCountryLabel ? (
                  <>
                    <br />
                    <span className={styles.tooltipMuted}>{hostCountryLabel}</span>
                  </>
                ) : null}
              </Tooltip>
              <Popup>
                <strong>{hostFlag ? `${hostFlag} ` : ''}Agent</strong>
                <br />
                {ep.hostname || ep.id}
                <br />
                <span className={styles.mono}>{ip}</span>
                <br />
                {hostCountryLabel || g.country || g.countryCode || ''}
              </Popup>
            </CircleMarker>
          );
        })}

        {remoteMarkers.map((r) => {
          const rmCc = (r.countryCode || (typeof r.country === 'string' && r.country.length === 2 ? r.country : '') || '').trim() || null;
          const rmFlag = flagEmoji(rmCc);
          const rmCountryLabel = rmCc ? countryDisplayName(rmCc) : (r.country && r.country !== '—' ? r.country : '');
          return (
            <CircleMarker
              key={`${r.lat},${r.lng},${r.ip}`}
              center={[r.lat, r.lng]}
              radius={compact ? 4 : 6}
              className="geoRemoteNode"
              pathOptions={{
                color: '#a78bfa',
                fillColor: '#22d3ee',
                fillOpacity: 0.75,
                weight: 1,
              }}
            >
              <Tooltip
                permanent={!compact}
                direction="top"
                offset={[0, compact ? -6 : -8]}
                className={styles.markerTooltip}
              >
                <span className={styles.tooltipFlag}>{rmFlag ? `${rmFlag} ` : ''}</span>
                <span className={styles.mono}>{r.ip}</span>
                {rmCountryLabel ? (
                  <>
                    <br />
                    <span className={styles.tooltipMuted}>{rmCountryLabel}</span>
                  </>
                ) : null}
              </Tooltip>
              <Popup>
                <strong>{rmFlag ? `${rmFlag} ` : ''}Remote</strong>
                <br />
                <span className={styles.mono}>{r.ip}</span>
                <br />
                {rmCountryLabel || r.country}
                <br />
                <span className={styles.dim}>Weight ~{Math.round(r.weight)}</span>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {(connections || []).length > 0 && edges.length === 0 && !geoErr ? (
        <div className={styles.noGeo} role="status">
          No geolocated remote IPs in this sample (private addresses or unresolved).
        </div>
      ) : null}

      <div className={styles.legend}>
        <span>
          <i className={styles.dotHost} /> Agent (public IP)
        </span>
        <span>
          <i className={styles.dotRemote} /> Remote destination
        </span>
        <span className={styles.dim}>Arcs animate toward hosted country (GeoLite)</span>
      </div>
    </div>
  );
}
