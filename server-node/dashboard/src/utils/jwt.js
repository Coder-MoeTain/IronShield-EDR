/**
 * Client-side JWT expiry check (no signature verification — server remains authoritative).
 */
export function isJwtExpired(token, skewMs = 15_000) {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const json = base64UrlToJson(parts[1]);
    const exp = json?.exp;
    if (typeof exp !== 'number') return false;
    return exp * 1000 < Date.now() + skewMs;
  } catch {
    return true;
  }
}

function base64UrlToJson(segment) {
  let s = segment.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const decoded = atob(s);
  return JSON.parse(decoded);
}
