/**
 * IronShield EDR Platform - Configuration
 */
require('dotenv').config();

function requiredEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(v);
}

function envOrNull(name) {
  const v = process.env[name];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

const derivedEnv = process.env.npm_lifecycle_event === 'dev'
  ? 'development'
  : (process.env.NODE_ENV || 'development');

module.exports = {
  env: derivedEnv,
  port: parseInt(process.env.PORT || '3000', 10),
  tls: {
    enabled: process.env.TLS_ENABLED === 'true',
    keyPath: envOrNull('TLS_KEY_PATH'),
    certPath: envOrNull('TLS_CERT_PATH'),
    caPath: envOrNull('TLS_CA_PATH'),
    agentMtlsRequired: process.env.AGENT_MTLS_REQUIRED === 'true',
  },
  security: {
    // Enterprise defaults: in production require TLS and mTLS for agent channel unless explicitly disabled.
    enforceTlsInProduction: process.env.ENFORCE_TLS_IN_PRODUCTION !== 'false',
    enforceAgentMtlsInProduction: process.env.ENFORCE_AGENT_MTLS_IN_PRODUCTION !== 'false',
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    token: envOrNull('METRICS_TOKEN'),
  },
  http: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    corsOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  db: {
    host: requiredEnv('DB_HOST'),
    port: parseInt(requiredEnv('DB_PORT'), 10),
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: requiredEnv('DB_NAME'),
  },
  jwt: {
    secret: requiredEnv('JWT_SECRET'),
    /** Optional: previous signing key while rotating JWT_SECRET (verify-only). */
    secretPrevious: envOrNull('JWT_SECRET_PREVIOUS'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  auth: {
    maxFailedLogins: parseInt(process.env.AUTH_MAX_FAILED_LOGINS || '5', 10),
    lockMinutes: parseInt(process.env.AUTH_LOCK_MINUTES || '15', 10),
    enforceMfaAllAdmins: process.env.AUTH_ENFORCE_MFA_ALL_ADMINS === 'true',
    requireMfaForLocalLogin: process.env.AUTH_REQUIRE_MFA_LOCAL_LOGIN === 'true',
  },
  sso: {
    oidcEnabled: process.env.OIDC_ENABLED === 'true',
    oidcIssuer: envOrNull('OIDC_ISSUER_URL'),
    oidcClientId: envOrNull('OIDC_CLIENT_ID'),
    oidcClientSecret: envOrNull('OIDC_CLIENT_SECRET'),
    oidcRedirectUri: envOrNull('OIDC_REDIRECT_URI'),
    oidcScope: process.env.OIDC_SCOPE || 'openid profile email',
    oidcAcrValues: envOrNull('OIDC_ACR_VALUES'),
    samlEnabled: process.env.SAML_ENABLED === 'true',
    samlTrustedHeaderUser: process.env.SAML_TRUSTED_HEADER_USER || 'x-sso-user',
    samlTrustedHeaderEmail: process.env.SAML_TRUSTED_HEADER_EMAIL || 'x-sso-email',
    samlTrustedHeaderNameId: process.env.SAML_TRUSTED_HEADER_NAMEID || 'x-sso-nameid',
    samlTrustedProxySecret: envOrNull('SAML_TRUSTED_PROXY_SECRET'),
  },
  agent: {
    registrationToken: requiredEnv('AGENT_REGISTRATION_TOKEN'),
  },
  notifications: {
    inApp: process.env.NOTIFICATIONS_IN_APP !== 'false',
  },
  audit: {
    archivePath: envOrNull('AUDIT_ARCHIVE_PATH'),
    archiveHmacKey: envOrNull('AUDIT_ARCHIVE_HMAC_KEY'),
    /** NDJSON spill file when DB audit insert fails (SOC evidence recovery). */
    failureLogPath: envOrNull('AUDIT_FAILURE_LOG_PATH'),
  },
  redis: {
    url: envOrNull('REDIS_URL'),
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID || 'ironshield-edr',
    enabled: process.env.KAFKA_ENABLED === 'true',
    topics: {
      rawEndpoint: process.env.KAFKA_TOPIC_RAW_ENDPOINT || 'xdr.raw.endpoint',
      rawWeb: process.env.KAFKA_TOPIC_RAW_WEB || 'xdr.raw.web',
      rawAuth: process.env.KAFKA_TOPIC_RAW_AUTH || 'xdr.raw.auth',
      rawZeek: process.env.KAFKA_TOPIC_RAW_ZEEK || 'xdr.raw.zeek',
      normalized: process.env.KAFKA_TOPIC_NORMALIZED || 'xdr.normalized',
      detections: process.env.KAFKA_TOPIC_DETECTIONS || 'xdr.detections',
    },
    groupId: process.env.KAFKA_GROUP_ID || 'ironshield-workers',
  },
  ingest: {
    key: envOrNull('XDR_INGEST_KEY'),
  },
};
