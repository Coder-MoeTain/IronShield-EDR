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

const agentRoutes = require('./routes/agentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
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

app.use('/api/agent', agentLimiter);
app.use('/api/auth', authLimiter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);

// 404 for unmatched API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// Serve dashboard static files if present
app.use(express.static('public'));

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'EDR Backend started');
});

// Phase B: periodic alert correlation (when not using only inline correlation on ingest)
const CorrelationService = require('./services/CorrelationService');
const corrMs = parseInt(process.env.CORRELATION_INTERVAL_MS || '300000', 10);
if (!Number.isNaN(corrMs) && corrMs > 0) {
  setInterval(() => {
    CorrelationService.correlateRecentAlerts().catch(() => {});
  }, corrMs);
  logger.info({ intervalMs: corrMs }, 'Alert correlation scheduler enabled');
}

process.on('SIGTERM', () => {
  server.close(() => logger.info('Server closed'));
});
