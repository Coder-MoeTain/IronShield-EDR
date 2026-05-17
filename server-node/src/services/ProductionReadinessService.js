/**
 * Production readiness score v2 — grouped checks with Fix next recommendations.
 */
const config = require('../config');
const healthChecks = require('../utils/healthChecks');
const db = require('../utils/db');
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  {
    id: 'security_posture',
    label: 'Security posture',
    checks: [
      {
        id: 'tls',
        label: 'TLS enabled',
        weight: 12,
        fix: 'Enable TLS (TLS_ENABLED=true) and terminate HTTPS at your reverse proxy.',
        missing: 'TLS_ENABLED is not true in production',
      },
      {
        id: 'cors',
        label: 'CORS restricted',
        weight: 8,
        fix: 'Set CORS_ORIGINS to an explicit allowlist (no wildcard in production).',
        missing: 'CORS_ORIGINS is empty',
      },
      {
        id: 'metrics',
        label: 'Metrics protected',
        weight: 8,
        fix: 'Set METRICS_TOKEN when METRICS_ENABLED=true.',
        missing: 'Metrics endpoint is enabled without METRICS_TOKEN',
      },
      {
        id: 'audit_chain',
        label: 'Audit hash chain',
        weight: 10,
        fix: 'Run npm run migrate to create audit_log_chain table.',
        missing: 'audit_log_chain table not found',
      },
    ],
  },
  {
    id: 'agent_trust',
    label: 'Agent trust',
    checks: [
      {
        id: 'mtls',
        label: 'mTLS for agents',
        weight: 12,
        fix: 'Set AGENT_MTLS_REQUIRED=true and enroll agent client certificates.',
        missing: 'AGENT_MTLS_REQUIRED is not enabled',
      },
      {
        id: 'agent_signing',
        label: 'Agent request signing',
        weight: 12,
        fix: 'Set AGENT_REQUEST_SIGNING_REQUIRED=true for production agents.',
        missing: 'Agent HMAC signing is not required',
      },
      {
        id: 'agent_key_hash',
        label: 'Agent key hashing',
        weight: 10,
        fix: 'Set AGENT_KEY_PEPPER to a long random secret.',
        missing: 'AGENT_KEY_PEPPER is not configured',
      },
      {
        id: 'redis_nonce',
        label: 'Redis nonce replay protection',
        weight: 10,
        fix: 'Configure REDIS_URL and ensure Redis is reachable for nonce storage.',
        missing: 'Redis is configured but not healthy',
      },
    ],
  },
  {
    id: 'detection_quality',
    label: 'Detection quality',
    checks: [
      {
        id: 'detections',
        label: 'Detection pack present',
        weight: 14,
        fix: 'Ensure server-node/detections/windows contains IRN-WIN rules.',
        missing: 'detections/windows directory missing',
      },
      {
        id: 'detections_test',
        label: 'Detection tests passing',
        weight: 10,
        fix: 'Run npm run detections:test and fix failing rule fixtures.',
        missing: 'detections:test script or fixtures missing',
      },
    ],
  },
  {
    id: 'data_pipeline',
    label: 'Data pipeline health',
    checks: [
      {
        id: 'retention',
        label: 'Retention jobs configured',
        weight: 10,
        fix: 'Set RETENTION_CRON_ENABLED=true or DATA_RETENTION_DAYS.',
        missing: 'No retention policy env vars set',
      },
    ],
  },
  {
    id: 'backup_dr',
    label: 'Backup / DR',
    checks: [
      {
        id: 'backup',
        label: 'Backup configured',
        weight: 14,
        fix: 'Set BACKUP_PATH or BACKUP_S3_BUCKET for automated backups.',
        missing: 'BACKUP_PATH / BACKUP_S3_BUCKET not set',
      },
    ],
  },
  {
    id: 'docs_tests',
    label: 'Documentation / tests',
    checks: [
      {
        id: 'openapi',
        label: 'OpenAPI spec present',
        weight: 10,
        fix: 'Run npm run test:openapi to sync and validate openapi.json.',
        missing: 'openapi/openapi.json missing',
      },
      {
        id: 'tenant_isolation',
        label: 'Tenant isolation tests',
        weight: 10,
        fix: 'Keep test/tenantIsolation.integration.test.js and run with RUN_DB_TESTS=true in CI.',
        missing: 'tenantIsolation.integration.test.js not found',
      },
    ],
  },
];

async function evaluateCheck(id) {
  const isDev = config.env === 'development';
  switch (id) {
    case 'tls':
      return {
        ok: config.tls?.enabled === true || isDev,
        detail: config.tls?.enabled ? 'TLS enabled' : isDev ? 'dev mode' : 'TLS disabled',
      };
    case 'mtls':
      return {
        ok: config.tls?.agentMtlsRequired === true || isDev,
        detail: config.tls?.agentMtlsRequired ? 'mTLS required' : isDev ? 'dev mode' : 'mTLS off',
      };
    case 'agent_signing':
      return {
        ok: config.agent?.requestSigningRequired === true || config.env !== 'production',
        detail: config.agent?.requestSigningRequired ? 'signing required' : 'signing optional',
      };
    case 'agent_key_hash':
      return {
        ok: Boolean(config.agent?.keyPepper) || isDev,
        detail: config.agent?.keyPepper ? 'pepper set' : isDev ? 'dev mode' : 'no pepper',
      };
    case 'redis_nonce':
      try {
        const r = await healthChecks.checkRedisIfConfigured();
        if (!r?.configured) return { ok: true, detail: 'Redis not required' };
        return { ok: r.ok, detail: r.ok ? 'Redis OK' : 'Redis unreachable' };
      } catch {
        return { ok: false, detail: 'Redis check failed' };
      }
    case 'audit_chain':
      try {
        const row = await db.queryOne(
          `SELECT COUNT(*) as c FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'audit_log_chain'`
        );
        const ok = Number(row?.c || 0) > 0;
        return { ok, detail: ok ? 'chain table exists' : 'chain table missing' };
      } catch {
        return { ok: false, detail: 'DB unavailable' };
      }
    case 'cors':
      return {
        ok: (config.http?.corsOrigins || []).length > 0 || isDev,
        detail: (config.http?.corsOrigins || []).length
          ? `${config.http.corsOrigins.length} origin(s)`
          : 'no CORS allowlist',
      };
    case 'metrics':
      return {
        ok: !config.metrics?.enabled || Boolean(config.metrics?.token),
        detail: config.metrics?.enabled ? (config.metrics?.token ? 'token set' : 'no token') : 'metrics off',
      };
    case 'backup':
      return {
        ok: Boolean(process.env.BACKUP_PATH || process.env.BACKUP_S3_BUCKET),
        detail: process.env.BACKUP_PATH || process.env.BACKUP_S3_BUCKET || 'not configured',
      };
    case 'retention':
      return {
        ok: Boolean(process.env.RETENTION_CRON_ENABLED === 'true' || process.env.DATA_RETENTION_DAYS),
        detail: process.env.DATA_RETENTION_DAYS
          ? `retention ${process.env.DATA_RETENTION_DAYS}d`
          : process.env.RETENTION_CRON_ENABLED === 'true'
            ? 'cron enabled'
            : 'not configured',
      };
    case 'openapi': {
      const specPath = path.join(__dirname, '../../openapi/openapi.json');
      return { ok: fs.existsSync(specPath), detail: fs.existsSync(specPath) ? 'spec OK' : 'missing spec' };
    }
    case 'detections': {
      const detDir = path.join(__dirname, '../../detections/windows');
      let count = 0;
      if (fs.existsSync(detDir)) {
        const walk = (dir) => {
          for (const name of fs.readdirSync(dir)) {
            const p = path.join(dir, name);
            if (fs.statSync(p).isDirectory()) walk(p);
            else if (name.endsWith('.json') && name.startsWith('IRN-WIN')) count += 1;
          }
        };
        walk(detDir);
      }
      return {
        ok: count >= 31,
        detail: count ? `${count} IRN-WIN rules` : 'no rules',
      };
    }
    case 'detections_test': {
      const script = path.join(__dirname, '../../detections/tools/testRules.js');
      return { ok: fs.existsSync(script), detail: fs.existsSync(script) ? 'script present' : 'missing script' };
    }
    case 'tenant_isolation': {
      const testFile = path.join(__dirname, '../../test/tenantIsolation.integration.test.js');
      return { ok: fs.existsSync(testFile), detail: fs.existsSync(testFile) ? 'test file present' : 'missing test' };
    }
    default:
      return { ok: false, detail: 'unknown check' };
  }
}

function findCheckDef(id) {
  for (const cat of CATEGORIES) {
    const c = cat.checks.find((x) => x.id === id);
    if (c) return { ...c, category: cat.id, categoryLabel: cat.label };
  }
  return null;
}

async function getScore() {
  const categories = [];
  const checks = [];
  const fixNext = [];
  let earned = 0;
  let total = 0;

  for (const cat of CATEGORIES) {
    let catEarned = 0;
    let catTotal = 0;
    const catChecks = [];

    for (const c of cat.checks) {
      const result = await evaluateCheck(c.id);
      const item = {
        ...c,
        ok: result.ok,
        detail: result.detail,
        missing: result.ok ? undefined : c.missing,
      };
      catChecks.push(item);
      checks.push({ ...item, category: cat.id, categoryLabel: cat.label });
      catTotal += c.weight;
      total += c.weight;
      if (result.ok) {
        catEarned += c.weight;
        earned += c.weight;
      } else if (fixNext.length < 5) {
        fixNext.push({
          id: c.id,
          label: c.label,
          category: cat.label,
          fix: c.fix,
          missing: c.missing,
          detail: result.detail,
        });
      }
    }

    categories.push({
      id: cat.id,
      label: cat.label,
      score: catTotal > 0 ? Math.round((catEarned / catTotal) * 100) : 0,
      earned: catEarned,
      total: catTotal,
      checks: catChecks,
    });
  }

  let score = total > 0 ? Math.round((earned / total) * 100) : 0;

  const isProd = config.env === 'production';
  const criticalIds = ['mtls', 'agent_signing', 'agent_key_hash', 'redis_nonce'];
  const criticalFailed = isProd
    ? checks.filter((c) => criticalIds.includes(c.id) && !c.ok).map((c) => c.id)
    : [];

  let capped = false;
  if (isProd && criticalFailed.length > 0 && score >= 90) {
    score = 89;
    capped = true;
    fixNext.unshift({
      id: 'critical_agent_trust',
      label: 'Critical agent trust checks failed',
      category: 'Agent trust',
      fix: 'Enable AGENT_REQUEST_SIGNING_REQUIRED, AGENT_KEY_PEPPER, AGENT_MTLS_REQUIRED, and Redis nonce store.',
      missing: `Failed: ${criticalFailed.join(', ')}`,
      detail: 'Production score capped below 90 until resolved',
    });
  }

  return {
    version: 2,
    score,
    maxScore: 100,
    earned,
    total,
    capped,
    critical_failed: criticalFailed,
    categories,
    checks,
    fix_next: fixNext,
  };
}

module.exports = { getScore, CATEGORIES, evaluateCheck, findCheckDef };
