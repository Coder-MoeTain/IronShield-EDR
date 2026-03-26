/**
 * IronShield EDR Platform - Node.js Backend
 * Phase 1 + Phase 2
 */
const express = require('express');
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

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (no Origin) and same-origin calls.
      if (!origin) return cb(null, true);
      const allow = config.http?.corsOrigins || [];
      if (allow.length === 0) {
        // Dev-friendly default (explicit allowlist recommended for production)
        return cb(null, true);
      }
      return allow.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked'), false);
    },
    credentials: false,
  })
);
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

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const route = req.route?.path ? String(req.route.path) : req.path;
      httpRequestsTotal.inc({
        method: req.method,
        route: route || 'unknown',
        status: String(res.statusCode),
      });
      // basic latency in logs only (metrics latency can be added later)
      const ms = Date.now() - start;
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

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'EDR Backend started');
});

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
