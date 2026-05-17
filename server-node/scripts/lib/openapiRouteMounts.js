/**
 * Express route file → API mount prefix (must match app.js mountApiRoutes).
 */
const ROUTE_MOUNT_MAP = {
  'src/routes/agentRoutes.js': '/agent',
  'src/routes/adminRoutes.js': '/admin',
  'src/routes/authRoutes.js': '/auth',
  'src/routes/ingestRoutes.js': '/ingest',
  'src/routes/consoleRoutes.js': '/console',
  'src/routes/softwareRoutes.js': '/software',
  'src/routes/detectionRoutes.js': '/detections',
};

function apiPathsForRoute(mountPrefix, routePath) {
  if (!routePath.startsWith('/')) return [];
  const base = `${mountPrefix}${routePath}`;
  return [`/api${base}`, `/api/v1${base}`];
}

function collectRoutesFromFile(root, relPath) {
  const mount = ROUTE_MOUNT_MAP[relPath];
  if (!mount) return [];
  const text = require('fs').readFileSync(require('path').join(root, relPath), 'utf8');
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const paths = apiPathsForRoute(mount, m[2]);
    for (const p of paths) out.push({ method: m[1].toLowerCase(), path: p });
  }
  return out;
}

module.exports = { ROUTE_MOUNT_MAP, apiPathsForRoute, collectRoutesFromFile };
