/**
 * IronShield EDR Platform - Node.js Backend
 * Phase 1 + Phase 2
 */
const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { attachRealtime } = require('./realtime/realtimeServer');
const db = require('./utils/db');
const promClient = require('prom-client');

const agentRoutes = require('./routes/agentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const ingestRoutes = require('./routes/ingestRoutes');

const app = express();

if (config.http?.trustProxy) {
  // Allows correct req.ip / X-Forwarded-For behind reverse proxies
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

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (no Origin).
      if (!origin) return cb(null, true);
      const allow = config.http?.corsOrigins || [];
      if (allow.length > 0) {
        return allow.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked'), false);
      }
      // No allowlist: allow same-origin only (e.g. module scripts / assets still send Origin).
      if (originMatchesRequest(origin, req)) return cb(null, true);
      return cb(new Error('CORS blocked (CORS_ORIGINS not configured)'), false);
    },
    credentials: false,
  })(req, res, next);
});
app.use(express.json({ limit: '2mb' }));

// Rate limiting
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts' },
});
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { error: 'Too many requests' },
});
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  message: { error: 'Too many requests' },
});

app.use('/api/agent', agentLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/admin', adminLimiter);
app.use('/api/ingest', ingestLimiter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/readyz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (e) {
    res.status(503).json({ status: 'not_ready', error: e.message || 'db_error' });
  }
});

// Prometheus metrics (optional, token-protected)
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
      if (String(provided || '') !== String(tok)) return res.status(401).json({ error: 'Unauthorized' });
    }
    res.setHeader('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ingest', ingestRoutes);

// 404 for unmatched API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// Serve dashboard static files if present
app.use(express.static('public'));
const dashboardIndexPath = path.resolve(process.cwd(), 'public', 'index.html');
app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (fs.existsSync(dashboardIndexPath)) return res.sendFile(dashboardIndexPath);
  return next();
});

// Error handler
app.use(errorHandler);

function createServer() {
  if (config.env === 'production' && config.security?.enforceTlsInProduction && !config.tls?.enabled) {
    throw new Error('Production requires TLS (set TLS_ENABLED=true or disable ENFORCE_TLS_IN_PRODUCTION explicitly)');
  }
  if (config.env === 'production' && config.security?.enforceAgentMtlsInProduction && !config.tls?.agentMtlsRequired) {
    throw new Error('Production requires agent mTLS (set AGENT_MTLS_REQUIRED=true or disable ENFORCE_AGENT_MTLS_IN_PRODUCTION explicitly)');
  }
  if (!config.tls?.enabled) {
    return app.listen(config.port, () => {
      logger.info({ port: config.port, env: config.env }, 'EDR Backend started (HTTP)');
    });
  }

  if (!config.tls.keyPath || !config.tls.certPath) {
    throw new Error('TLS enabled but TLS_KEY_PATH/TLS_CERT_PATH not set');
  }

  const tlsOpts = {
    key: fs.readFileSync(config.tls.keyPath),
    cert: fs.readFileSync(config.tls.certPath),
    minVersion: 'TLSv1.2',
  };

  if (config.tls.caPath) {
    tlsOpts.ca = fs.readFileSync(config.tls.caPath);
  }
  if (config.tls.agentMtlsRequired) {
    // Request and validate client certificates signed by TLS_CA_PATH.
    tlsOpts.requestCert = true;
    tlsOpts.rejectUnauthorized = true;
  }

  return https.createServer(tlsOpts, app).listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'EDR Backend started (HTTPS)');
  });
}

const server = createServer();

// Phase 6: websocket realtime (optional)
attachRealtime(server);

// Phase B: periodic alert correlation (when not using only inline correlation on ingest)
const CorrelationService = require('./services/CorrelationService');
const corrMs = parseInt(process.env.CORRELATION_INTERVAL_MS || '300000', 10);
if (!Number.isNaN(corrMs) && corrMs > 0) {
  setInterval(() => {
    CorrelationService.correlateRecentAlerts().catch(() => {});
    CorrelationService.correlateRecentXdrDetections().catch(() => {});
  }, corrMs);
  logger.info({ intervalMs: corrMs }, 'Alert correlation scheduler enabled');
}

// Phase 7: auto-response scheduler (opt-in)
const AutoResponse = require('./xdr/xdrAutoResponseService');
const arMs = parseInt(process.env.XDR_AUTORESP_INTERVAL_MS || '60000', 10);
if (!Number.isNaN(arMs) && arMs > 0) {
  setInterval(() => {
    AutoResponse.runOnce().catch(() => {});
  }, arMs);
}

process.on('SIGTERM', () => {
  server.close(() => logger.info('Server closed'));
});
