/** Great-circle arc as [lat, lng][] for Leaflet Polylines */

export function greatCircleArc(lat1, lng1, lat2, lng2, segments = 56) {
  const φ1 = (lat1 * Math.PI) / 180;
  const λ1 = (lng1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ2 = (lng2 * Math.PI) / 180;
  const cosD = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const d = Math.acos(Math.min(1, Math.max(-1, cosD)));
  if (!Number.isFinite(d) || d < 1e-8) {
    return [
      [lat1, lng1],
      [lat2, lng2],
    ];
  }
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const φ3 = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λ3 = Math.atan2(y, x);
    pts.push([(φ3 * 180) / Math.PI, (λ3 * 180) / Math.PI]);
  }
  return pts;
}

export function trafficNorm(w, minW, maxW) {
  const lw = Math.log(Math.max(1, w));
  const lmin = Math.log(Math.max(1, minW));
  const lmax = Math.log(Math.max(1, maxW));
  if (lmax <= lmin) return 0.5;
  return Math.max(0, Math.min(1, (lw - lmin) / (lmax - lmin)));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
