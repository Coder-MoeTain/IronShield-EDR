/**
 * Prefer versioned API paths; legacy /api/* remains supported on the server.
 */
export function apiPath(path) {
  if (!path || typeof path !== 'string') return path;
  if (path.startsWith('/api/v1/')) return path;
  if (path.startsWith('/api/')) return path.replace(/^\/api\//, '/api/v1/');
  return path;
}
