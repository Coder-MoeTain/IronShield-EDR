/**
 * IronShield EDR Platform - Node.js Backend
 * HTTP app: ./app.js — this file listens and runs background schedulers.
 */
const fs = require('fs');
const https = require('https');
const config = require('./config');
const logger = require('./utils/logger');
const { attachRealtime } = require('./realtime/realtimeServer');
const { app } = require('./app');

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
    tlsOpts.requestCert = true;
    tlsOpts.rejectUnauthorized = true;
  }

  return https.createServer(tlsOpts, app).listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'EDR Backend started (HTTPS)');
  });
}

const server = createServer();

attachRealtime(server);

const CorrelationService = require('./services/CorrelationService');
const corrMs = parseInt(process.env.CORRELATION_INTERVAL_MS || '300000', 10);
if (!Number.isNaN(corrMs) && corrMs > 0) {
  setInterval(() => {
    CorrelationService.correlateRecentAlerts().catch(() => {});
    CorrelationService.correlateRecentXdrDetections().catch(() => {});
  }, corrMs);
  logger.info({ intervalMs: corrMs }, 'Alert correlation scheduler enabled');
}

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
