/**
 * Environment validation (Zod) — fail fast on invalid or weak production secrets.
 */
const { z } = require('zod');

const WEAK_JWT_SECRETS = new Set([
  'change-me',
  'changeme',
  'secret',
  'jwt_secret',
  'your-secret',
  'dev-secret',
  'test',
  'password',
  'ironshield',
]);

const WEAK_AGENT_TOKENS = new Set([
  'change-me',
  'changeme',
  'registration-token',
  'agent-token',
  'dev-token',
  'test',
]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
    PORT: z.coerce.number().int().min(1).max(65535).optional(),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().optional(),
    DB_NAME: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_SECRET_PREVIOUS: z.string().optional(),
    JWT_EXPIRES_IN: z.string().optional(),
    JWT_REFRESH_EXPIRES_IN: z.string().optional(),
    AGENT_REGISTRATION_TOKEN: z.string().min(1),
    AGENT_REQUEST_SIGNING_REQUIRED: z.enum(['true', 'false']).optional(),
    AGENT_REQUEST_SIGNING_MAX_SKEW_SECONDS: z.coerce.number().int().min(30).max(3600).optional(),
    AGENT_NONCE_STORE: z.enum(['memory', 'mysql', 'redis']).optional(),
    EVENT_STORE: z.enum(['mysql', 'opensearch', 'clickhouse']).optional(),
    RTR_ENABLED: z.enum(['true', 'false']).optional(),
    RTR_SESSION_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(480).optional(),
    RTR_COMMAND_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(600).optional(),
    RTR_MAX_OUTPUT_BYTES: z.coerce.number().int().min(4096).max(1048576).optional(),
    AGENT_KEY_PEPPER: z.string().optional(),
    RESPONSE_COMMAND_HMAC_KEY: z.string().optional(),
    RESPONSE_COMMAND_TTL_SEC: z.coerce.number().int().min(60).max(86400).optional(),
    INGEST_QUEUE_FIRST: z.enum(['true', 'false']).optional(),
    CORS_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.enum(['true', 'false']).optional(),
    TLS_ENABLED: z.enum(['true', 'false']).optional(),
    TLS_KEY_PATH: z.string().optional(),
    TLS_CERT_PATH: z.string().optional(),
    TLS_CA_PATH: z.string().optional(),
    AGENT_MTLS_REQUIRED: z.enum(['true', 'false']).optional(),
    ENFORCE_TLS_IN_PRODUCTION: z.enum(['true', 'false']).optional(),
    ENFORCE_AGENT_MTLS_IN_PRODUCTION: z.enum(['true', 'false']).optional(),
    METRICS_ENABLED: z.enum(['true', 'false']).optional(),
    METRICS_TOKEN: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().int().optional(),
    REDIS_PASSWORD: z.string().optional(),
    KAFKA_ENABLED: z.enum(['true', 'false']).optional(),
    KAFKA_BROKERS: z.string().optional(),
    KAFKA_CLIENT_ID: z.string().optional(),
    KAFKA_GROUP_ID: z.string().optional(),
    KAFKA_TOPIC_RAW_ENDPOINT: z.string().optional(),
    KAFKA_TOPIC_RAW_WEB: z.string().optional(),
    KAFKA_TOPIC_RAW_AUTH: z.string().optional(),
    KAFKA_TOPIC_RAW_ZEEK: z.string().optional(),
    KAFKA_TOPIC_NORMALIZED: z.string().optional(),
    KAFKA_TOPIC_DETECTIONS: z.string().optional(),
    XDR_INGEST_KEY: z.string().optional(),
    AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(1).max(100).optional(),
    AUTH_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).optional(),
    AUTH_ENFORCE_MFA_ALL_ADMINS: z.enum(['true', 'false']).optional(),
    AUTH_REQUIRE_MFA_LOCAL_LOGIN: z.enum(['true', 'false']).optional(),
    OIDC_ENABLED: z.enum(['true', 'false']).optional(),
    OIDC_ISSUER_URL: z.string().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    OIDC_REDIRECT_URI: z.string().optional(),
    OIDC_SCOPE: z.string().optional(),
    OIDC_ACR_VALUES: z.string().optional(),
    SAML_ENABLED: z.enum(['true', 'false']).optional(),
    SAML_TRUSTED_HEADER_USER: z.string().optional(),
    SAML_TRUSTED_HEADER_EMAIL: z.string().optional(),
    SAML_TRUSTED_HEADER_NAMEID: z.string().optional(),
    SAML_TRUSTED_PROXY_SECRET: z.string().optional(),
    RESPONSE_APPROVAL_REQUIRE_JUSTIFICATION_FOR_HIGH_RISK: z.enum(['true', 'false']).optional(),
    RESPONSE_APPROVAL_MIN_JUSTIFICATION_LENGTH: z.coerce.number().int().min(0).max(2000).optional(),
    NOTIFICATIONS_IN_APP: z.enum(['true', 'false']).optional(),
    AUDIT_ARCHIVE_PATH: z.string().optional(),
    AUDIT_ARCHIVE_HMAC_KEY: z.string().optional(),
    AUDIT_FAILURE_LOG_PATH: z.string().optional(),
    CONFIG_SKIP_PRODUCTION_SECRET_CHECK: z.enum(['true', 'false']).optional(),
  })
  .passthrough();

function trimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function assertProductionSecrets(env, parsed) {
  if (env !== 'production') return;
  if (parsed.CONFIG_SKIP_PRODUCTION_SECRET_CHECK === 'true') return;

  const jwt = parsed.JWT_SECRET.trim();
  if (jwt.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (WEAK_JWT_SECRETS.has(jwt.toLowerCase())) {
    throw new Error('JWT_SECRET is a known weak value; use a cryptographically random secret in production');
  }

  const agentTok = parsed.AGENT_REGISTRATION_TOKEN.trim();
  if (agentTok.length < 24) {
    throw new Error('AGENT_REGISTRATION_TOKEN must be at least 24 characters in production');
  }
  if (WEAK_AGENT_TOKENS.has(agentTok.toLowerCase())) {
    throw new Error('AGENT_REGISTRATION_TOKEN is a known weak value; use a strong break-glass token in production');
  }

  if (!trimOrNull(parsed.DB_PASSWORD)) {
    throw new Error('DB_PASSWORD is required in production');
  }

  if (trimOrNull(parsed.METRICS_ENABLED) !== 'false' && !trimOrNull(parsed.METRICS_TOKEN)) {
    throw new Error('METRICS_TOKEN is required in production when metrics are enabled');
  }

  const pepper = trimOrNull(parsed.AGENT_KEY_PEPPER);
  if (!pepper || pepper.length < 16) {
    throw new Error('AGENT_KEY_PEPPER must be at least 16 characters in production');
  }

  const cors = trimOrNull(parsed.CORS_ORIGINS);
  if (cors && (cors === '*' || cors.split(',').map((s) => s.trim()).includes('*'))) {
    throw new Error('CORS_ORIGINS must not be wildcard in production');
  }

  if (parsed.ENFORCE_TLS_IN_PRODUCTION !== 'false' && parsed.TLS_ENABLED !== 'true') {
    throw new Error('TLS_ENABLED must be true in production (or set ENFORCE_TLS_IN_PRODUCTION=false)');
  }

  if (parsed.ENFORCE_AGENT_MTLS_IN_PRODUCTION !== 'false' && parsed.AGENT_MTLS_REQUIRED !== 'true') {
    throw new Error('AGENT_MTLS_REQUIRED must be true in production (or set ENFORCE_AGENT_MTLS_IN_PRODUCTION=false)');
  }
}

function parseEnv(processEnv, derivedEnv) {
  const result = envSchema.safeParse(processEnv);
  if (!result.success) {
    const msg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const p = result.data;
  assertProductionSecrets(derivedEnv, p);
  return p;
}

module.exports = {
  envSchema,
  parseEnv,
  trimOrNull,
  WEAK_JWT_SECRETS,
  WEAK_AGENT_TOKENS,
};
