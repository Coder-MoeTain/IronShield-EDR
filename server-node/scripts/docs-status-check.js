#!/usr/bin/env node
/**
 * Validates README claims against repo files, routes, and scripts.
 * Exit 1 on contradictions (doc says missing but implemented, or claims missing file).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const serverNode = path.join(root, 'server-node');
let warnings = 0;
let errors = 0;

function warn(msg) {
  console.warn(`[warn] ${msg}`);
  warnings += 1;
}

function fail(msg) {
  console.error(`[error] ${msg}`);
  errors += 1;
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// Implemented features — doc must not say "missing"
const IMPLEMENTED = [
  { id: 'api_v1', file: 'server-node/src/app.js', mustContain: '/api/v1' },
  { id: 'console_bff', file: 'server-node/src/routes/consoleRoutes.js' },
  { id: 'migrate_runner', file: 'server-node/scripts/migrate.js' },
  { id: 'compose_dev', file: 'docker-compose.dev.yml' },
  { id: 'compose_prod', file: 'docker-compose.prod.yml' },
  { id: 'detections_pack', dir: 'server-node/detections/windows' },
  { id: 'upgrade_audit', file: 'docs/UPGRADE_AUDIT.md' },
  { id: 'api_coverage', file: 'docs/API_COVERAGE.md' },
  { id: 'legacy_migrations', file: 'docs/legacy-migrations.md' },
  { id: 'route_map', file: 'server-node/dashboard/src/routes/routeMap.jsx' },
  { id: 'legacy_redirects', file: 'server-node/dashboard/src/routes/legacyRedirects.js' },
  { id: 'production_readiness', file: 'server-node/src/services/ProductionReadinessService.js' },
];

for (const item of IMPLEMENTED) {
  const target = item.dir || item.file;
  if (!exists(target)) fail(`Expected ${target} for ${item.id}`);
  else if (item.mustContain) {
    const content = read(item.file);
    if (!content.includes(item.mustContain)) warn(`${item.file} does not contain "${item.mustContain}"`);
  }
}

// README claims — scripts must exist
const pkg = JSON.parse(read('server-node/package.json'));
const readme = read('README.md');
const scriptsClaimed = ['migrate', 'migrate:status', 'seed', 'test', 'test:openapi', 'detections:test', 'detections:validate'];
for (const s of scriptsClaimed) {
  if (readme.includes(`npm run ${s}`) && !pkg.scripts[s]) {
    fail(`README references npm run ${s} but package.json has no script`);
  }
}

// Stale "missing" phrases in UPGRADE_AUDIT
const audit = read('docs/UPGRADE_AUDIT.md');
const stalePhrases = [
  'no `/api/v1` yet',
  'MITRE ATT&CK Coverage matrix page | **Missing**',
  'Reports (PDF/HTML/JSON exports) | **Missing**',
  'Dedicated SOC Triage Queue',
];
for (const phrase of stalePhrases) {
  if (audit.includes(phrase)) warn(`UPGRADE_AUDIT.md still contains stale phrase: ${phrase}`);
}

// Compact console routes in routeMap
const routeMap = read('server-node/dashboard/src/routes/routeMap.jsx');
const compactPaths = ['/overview', '/endpoints', '/detections', '/investigation', '/response', '/hunting', '/protection', '/admin'];
for (const p of compactPaths) {
  if (!routeMap.includes(`path: '${p.replace('/', '')}'`) && !routeMap.includes(`'${p.replace('/', '')}'`)) {
    warn(`routeMap may be missing compact path ${p}`);
  }
}

console.log(`docs:status-check complete — ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
