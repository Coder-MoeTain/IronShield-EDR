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
      {
        id: 'command_signing',
        label: 'Signed response commands',
        weight: 8,
        fix: 'Set RESPONSE_COMMAND_SIGNING_REQUIRED=true and RequireSignedResponseCommands on agents.',
        missing: 'Response command signing is not required',
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
        weight: 6,
        fix: 'Run npm run test:tenant-isolation in CI.',
        missing: 'tenant isolation test files missing',
      },
      {
        id: 'envelope_tests',
        label: 'API envelope tests',
        weight: 6,
        fix: 'Run npm run test:envelope and fix failing routes.',
        missing: 'envelope test files missing',
      },
      {
        id: 'rbac_tests',
        label: 'RBAC tests',
        weight: 6,
        fix: 'Run npm run test:rbac.',
        missing: 'rbac test files missing',
      },
      {
        id: 'software_tests',
        label: 'Software safety tests',
        weight: 6,
        fix: 'Run npm run test:software.',
        missing: 'software test files missing',
      },
      {
        id: 'detection_unit_tests',
        label: 'Detection unit tests',
        weight: 6,
        fix: 'Run npm run test:detections.',
        missing: 'detection unit test files missing',
      },
      {
        id: 'audit_verify',
        label: 'Audit hash verification CLI',
        weight: 6,
        fix: 'Run npm run audit:verify after migrations.',
        missing: 'audit:verify script missing',
      },
      {
        id: 'jwt_secret',
        label: 'JWT secret strength',
        weight: 8,
        fix: 'Set JWT_SECRET to a random string of at least 32 characters.',
        missing: 'JWT_SECRET is weak or too short in production',
      },
      {
        id: 'nonce_memory',
        label: 'Nonce store not in-memory',
        weight: 8,
        fix: 'Set AGENT_NONCE_STORE=redis (or mysql) in production.',
        missing: 'AGENT_NONCE_STORE=memory is not allowed in production',
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
    case 'command_signing':
      return {
        ok: config.response?.commandSigningRequired === true || config.env !== 'production',
        detail: config.response?.commandSigningRequired
          ? 'response commands signed'
          : 'response command signing optional',
      };
    case 'agent_key_hash':
      return {
        ok: Boolean(config.agent?.keyPepper) || isDev,
        detail: config.agent?.keyPepper ? 'pepper set' : isDev ? 'dev mode' : 'no pepper',
      };
    case 'redis_nonce': {
      if (config.env === 'production' && config.agent?.nonceStore === 'memory') {
        return { ok: false, detail: 'memory nonce store in production' };
      }
      try {
        const r = await healthChecks.checkRedisIfConfigured();
        if (config.agent?.nonceStore === 'redis') {
          return { ok: r?.ok === true, detail: r?.ok ? 'Redis OK' : 'Redis unreachable' };
        }
        if (!r?.configured) return { ok: config.agent?.nonceStore !== 'memory' || isDev, detail: 'MySQL nonce store' };
        return { ok: r.ok, detail: r.ok ? 'Redis OK' : 'Redis unreachable' };
      } catch {
        return { ok: false, detail: 'Redis check failed' };
      }
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
    case 'cors': {
      const origins = config.http?.corsOrigins || [];
      const hasWildcard = origins.some((o) => o === '*' || o === 'null');
      return {
        ok: (origins.length > 0 && !hasWildcard) || isDev,
        detail: hasWildcard
          ? 'CORS wildcard origin configured'
          : origins.length
            ? `${origins.length} origin(s)`
            : 'no CORS allowlist',
      };
    }
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
      const files = [
        'tenantIsolation.service.test.js',
        'requireTenantContext.test.js',
        'tenantQuery.test.js',
      ].map((f) => path.join(__dirname, '../../test', f));
      const ok = files.every((f) => fs.existsSync(f));
      return { ok, detail: ok ? 'test files present' : 'missing tenant isolation tests' };
    }
    case 'envelope_tests': {
      const files = ['envelopeResponse.test.js', 'envelopeRoutes.integration.test.js'].map((f) =>
        path.join(__dirname, '../../test', f)
      );
      const ok = files.every((f) => fs.existsSync(f));
      return { ok, detail: ok ? 'envelope tests present' : 'missing envelope tests' };
    }
    case 'rbac_tests': {
      const files = ['rbac.unit.test.js', 'rbacRouteMatrix.unit.test.js'].map((f) =>
        path.join(__dirname, '../../test', f)
      );
      const ok = files.every((f) => fs.existsSync(f));
      return { ok, detail: ok ? 'rbac tests present' : 'missing rbac tests' };
    }
    case 'software_tests': {
      const files = ['software.unit.test.js', 'softwareTenantIsolation.test.js'].map((f) =>
        path.join(__dirname, '../../test', f)
      );
      const ok = files.every((f) => fs.existsSync(f));
      return { ok, detail: ok ? 'software tests present' : 'missing software tests' };
    }
    case 'detection_unit_tests': {
      const files = ['detections.unit.test.js', 'detections.ruleReview.unit.test.js'].map((f) =>
        path.join(__dirname, '../../test', f)
      );
      const ok = files.every((f) => fs.existsSync(f));
      return { ok, detail: ok ? 'detection tests present' : 'missing detection tests' };
    }
    case 'audit_verify': {
      const script = path.join(__dirname, '../../scripts/audit-verify-cli.js');
      return { ok: fs.existsSync(script), detail: fs.existsSync(script) ? 'CLI present' : 'missing audit:verify' };
    }
    case 'jwt_secret': {
      const secret = String(config.jwt?.secret || '');
      const weak = new Set([
        'secret',
        'changeme',
        'replace-me-with-a-strong-secret',
        'your-secret-key',
        'jwt-secret',
      ]);
      const ok =
        isDev ||
        (secret.length >= 32 && !weak.has(secret.toLowerCase()) && !/^test/i.test(secret));
      return {
        ok,
        detail: ok ? 'JWT secret OK' : secret.length < 32 ? 'JWT_SECRET too short' : 'JWT_SECRET is weak',
      };
    }
    case 'nonce_memory':
      return {
        ok: config.env !== 'production' || config.agent?.nonceStore !== 'memory',
        detail:
          config.agent?.nonceStore === 'memory'
            ? 'memory store (dev only)'
            : `store: ${config.agent?.nonceStore || 'mysql'}`,
      };
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
  const criticalIds = [
    'mtls',
    'agent_signing',
    'command_signing',
    'agent_key_hash',
    'redis_nonce',
    'nonce_memory',
    'jwt_secret',
    'cors',
    'metrics',
    'openapi',
    'envelope_tests',
    'rbac_tests',
    'tenant_isolation',
    'software_tests',
    'detection_unit_tests',
    'detections_test',
    'audit_verify',
  ];
  const criticalFailed = isProd
    ? checks.filter((c) => criticalIds.includes(c.id) && !c.ok).map((c) => c.id)
    : [];

  let capped = false;
  if (isProd && criticalFailed.length > 0 && score >= 90) {
    score = 89;
    capped = true;
    fixNext.unshift({
      id: 'production_gate',
      label: 'Production readiness gate failed',
      category: 'Platform',
      fix: 'Resolve failed checks: run test:envelope, test:openapi, test:rbac, test:tenant-isolation, test:software, test:detections, detections:test, audit:verify; fix JWT, CORS, metrics token, and nonce store.',
      missing: `Failed: ${criticalFailed.join(', ')}`,
      detail: 'Score capped below 90 until all production gate checks pass',
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
