/**
 * Production readiness score (0–100) from config and health signals.
 */
const config = require('../config');
const healthChecks = require('../utils/healthChecks');
const db = require('../utils/db');
const fs = require('fs');
const path = require('path');

const CHECKS = [
  { id: 'tls', label: 'TLS enabled', weight: 10 },
  { id: 'mtls', label: 'mTLS for agents', weight: 10 },
  { id: 'agent_signing', label: 'Agent request signing', weight: 10 },
  { id: 'agent_key_hash', label: 'Agent key hashing', weight: 8 },
  { id: 'redis_nonce', label: 'Redis nonce replay protection', weight: 10 },
  { id: 'audit_chain', label: 'Audit hash chain', weight: 8 },
  { id: 'cors', label: 'CORS restricted', weight: 6 },
  { id: 'metrics', label: 'Metrics protected', weight: 6 },
  { id: 'backup', label: 'Backup configured', weight: 8 },
  { id: 'retention', label: 'Retention jobs', weight: 6 },
  { id: 'openapi', label: 'OpenAPI tests passing', weight: 8 },
  { id: 'detections', label: 'Detection tests passing', weight: 10 },
  { id: 'tenant_isolation', label: 'Tenant isolation tests', weight: 8 },
];

async function evaluateCheck(id) {
  switch (id) {
    case 'tls':
      return config.tls?.enabled === true || config.env === 'development';
    case 'mtls':
      return config.tls?.agentMtlsRequired === true || config.env === 'development';
    case 'agent_signing':
      return config.agent?.requestSigningRequired === true || config.env !== 'production';
    case 'agent_key_hash':
      return Boolean(config.agent?.keyPepper) || config.env === 'development';
    case 'redis_nonce':
      try {
        const r = await healthChecks.checkRedisIfConfigured();
        return r?.configured ? r.ok : true;
      } catch {
        return false;
      }
    case 'audit_chain':
      try {
        const row = await db.queryOne(
          `SELECT COUNT(*) as c FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'audit_log_chain'`
        );
        return Number(row?.c || 0) > 0;
      } catch {
        return false;
      }
    case 'cors':
      return (config.http?.corsOrigins || []).length > 0 || config.env === 'development';
    case 'metrics':
      return !config.metrics?.enabled || Boolean(config.metrics?.token);
    case 'backup':
      return Boolean(process.env.BACKUP_PATH || process.env.BACKUP_S3_BUCKET);
    case 'retention':
      return Boolean(process.env.RETENTION_CRON_ENABLED === 'true' || process.env.DATA_RETENTION_DAYS);
    case 'openapi': {
      const specPath = path.join(__dirname, '../../openapi/openapi.json');
      return fs.existsSync(specPath);
    }
    case 'detections': {
      const detDir = path.join(__dirname, '../../detections/windows');
      return fs.existsSync(detDir);
    }
    case 'tenant_isolation': {
      const testFile = path.join(__dirname, '../../test/tenantIsolation.integration.test.js');
      return fs.existsSync(testFile);
    }
    default:
      return false;
  }
}

async function getScore() {
  const items = [];
  let earned = 0;
  let total = 0;
  for (const c of CHECKS) {
    const ok = await evaluateCheck(c.id);
    items.push({ ...c, ok });
    total += c.weight;
    if (ok) earned += c.weight;
  }
  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { score, maxScore: 100, checks: items, earned, total };
}

module.exports = { getScore, CHECKS };
