/**
 * Express application (HTTP API + static dashboard).
 * Exported for integration tests and tooling; production entrypoint is index.js.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { requestIdMiddleware } = require('./middleware/requestId');
const { ERROR_CODES, sendErrorFromReq } = require('./utils/apiResponse');
const healthChecks = require('./utils/healthChecks');
const pkg = require('../package.json');
const promClient = require('prom-client');

const agentRoutes = require('./routes/agentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const detectionRoutes = require('./routes/detectionRoutes');
const authRoutes = require('./routes/authRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const consoleRoutes = require('./routes/consoleRoutes');
const softwareRoutes = require('./routes/softwareRoutes');

const app = express();

const API_PREFIXES = ['/api', '/api/v1'];

app.use(requestIdMiddleware);

if (config.http?.trustProxy) {
  app.set('trust proxy', 1);
}

function originMatchesRequest(origin, req) {
  if (!origin || !req) return false;
  const host = req.get('host');
  if (!host) return false;
  const proto = req.protocol || 'http';
  try {
    const u = new URL(origin);
    return u.protocol === `${proto}:` && u.host === host;
  } catch {
    return false;
  }
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allow = config.http?.corsOrigins || [];
      if (allow.length > 0) {
        return allow.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked'), false);
      }
      if (originMatchesRequest(origin, req)) return cb(null, true);
      return cb(new Error('CORS blocked (CORS_ORIGINS not configured)'), false);
    },
    credentials: false,
  })(req, res, next);
});
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf ? buf.toString('utf8') : '';
  },
}));

function rateLimitHandler(req, res) {
  return sendErrorFromReq(res, req, ERROR_CODES.RATE_LIMITED, 'Too many requests', 429);
}

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  handler: rateLimitHandler,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: rateLimitHandler,
});
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  handler: rateLimitHandler,
});
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  handler: rateLimitHandler,
});

for (const prefix of API_PREFIXES) {
  app.use(`${prefix}/agent`, agentLimiter);
  app.use(`${prefix}/auth`, authLimiter);
  app.use(`${prefix}/admin`, adminLimiter);
  app.use(`${prefix}/ingest`, ingestLimiter);
  app.use(`${prefix}/console`, adminLimiter);
}

app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    service: 'ironshield-edr',
    version: pkg.version || '1.0.0',
    timestamp: new Date().toISOString(),
  })
);
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/readyz', async (req, res) => {
  try {
    const detail = await healthChecks.readiness();
    res.json({ status: 'ready', ...detail });
  } catch (e) {
    res.status(503).json({
      status: 'not_ready',
      error: e.code === 'REDIS_DOWN' ? 'redis_unavailable' : e.message || 'check_failed',
    });
  }
});

if (config.metrics?.enabled) {
  promClient.collectDefaultMetrics({
    prefix: 'ironshield_',
  });

  const httpRequestsTotal = new promClient.Counter({
    name: 'ironshield_http_requests_total',
    help: 'HTTP requests total',
    labelNames: ['method', 'route', 'status'],
  });
  const httpRequestDurationMs = new promClient.Histogram({
    name: 'ironshield_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [25, 50, 100, 250, 500, 1000, 2000, 5000, 10000],
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const route = req.route?.path ? String(req.route.path) : req.path;
      const ms = Date.now() - start;
      httpRequestsTotal.inc({
        method: req.method,
        route: route || 'unknown',
        status: String(res.statusCode),
      });
      httpRequestDurationMs.observe(
        {
          method: req.method,
          route: route || 'unknown',
          status: String(res.statusCode),
        },
        ms
      );
      if (ms > 2000) logger.warn({ path: req.path, ms }, 'Slow request');
    });
    next();
  });

  app.get('/metrics', async (req, res) => {
    const tok = config.metrics?.token;
    if (tok) {
      const provided = req.headers['x-metrics-token'] || req.query.token;
      if (String(provided || '') !== String(tok)) {
        return sendErrorFromReq(res, req, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Unauthorized', 401);
      }
    }
    const metricsUtil = require('./utils/metrics');
    await metricsUtil.refreshSocReadinessGauges();
    res.setHeader('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });
}

function mountApiRoutes(basePath) {
  app.use(`${basePath}/auth`, authRoutes);
  app.use(`${basePath}/agent`, agentRoutes);
  app.use(`${basePath}/admin`, adminRoutes);
  app.use(`${basePath}/software`, softwareRoutes);
  app.use(`${basePath}/detections`, detectionRoutes);
  app.use(`${basePath}/ingest`, ingestRoutes);
  app.use(`${basePath}/console`, consoleRoutes);
}

for (const prefix of API_PREFIXES) {
  mountApiRoutes(prefix);
}

/** OpenAPI 3 contract; served on legacy and v1 paths. */
const OPENAPI_SPEC_PATH = path.resolve(__dirname, '..', 'openapi', 'openapi.json');

function serveOpenApi(req, res) {
  try {
    const raw = fs.readFileSync(OPENAPI_SPEC_PATH, 'utf8');
    const spec = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(spec);
  } catch (e) {
    logger.error({ err: e.message }, 'OpenAPI spec read failed');
    return sendErrorFromReq(
      res,
      req,
      ERROR_CODES.INTERNAL_ERROR,
      'OpenAPI specification unavailable',
      500
    );
  }
}

app.get('/api/openapi.json', serveOpenApi);
app.get('/api/v1/openapi.json', serveOpenApi);

app.use(['/api', '/api/v1'], (req, res) =>
  sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Not found', 404, { path: req.path })
);

app.use(express.static('public'));
const dashboardIndexPath = path.resolve(process.cwd(), 'public', 'index.html');
app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (fs.existsSync(dashboardIndexPath)) return res.sendFile(dashboardIndexPath);
  return next();
});

app.use(errorHandler);

module.exports = { app, API_PREFIXES };
