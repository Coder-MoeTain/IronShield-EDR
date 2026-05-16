/**
 * IronShield EDR Platform - Configuration (Zod-validated)
 */
require('dotenv').config();

const { parseEnv, trimOrNull } = require('./schema');

const derivedEnv =
  process.env.NODE_ENV === 'test'
    ? 'test'
    : process.env.npm_lifecycle_event === 'dev'
      ? 'development'
      : process.env.NODE_ENV || 'development';

const env = parseEnv(process.env, derivedEnv);

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  env: derivedEnv,
  port: env.PORT ?? 3000,
  tls: {
    enabled: env.TLS_ENABLED === 'true',
    keyPath: trimOrNull(env.TLS_KEY_PATH),
    certPath: trimOrNull(env.TLS_CERT_PATH),
    caPath: trimOrNull(env.TLS_CA_PATH),
    agentMtlsRequired: env.AGENT_MTLS_REQUIRED === 'true',
  },
  security: {
    enforceTlsInProduction: env.ENFORCE_TLS_IN_PRODUCTION !== 'false',
    enforceAgentMtlsInProduction: env.ENFORCE_AGENT_MTLS_IN_PRODUCTION !== 'false',
  },
  metrics: {
    enabled: env.METRICS_ENABLED !== 'false',
    token: trimOrNull(env.METRICS_TOKEN),
  },
  http: {
    trustProxy: env.TRUST_PROXY === 'true',
    corsOrigins: splitCsv(env.CORS_ORIGINS),
  },
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME,
  },
  jwt: {
    secret: env.JWT_SECRET,
    secretPrevious: trimOrNull(env.JWT_SECRET_PREVIOUS),
    expiresIn: env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  auth: {
    maxFailedLogins: env.AUTH_MAX_FAILED_LOGINS ?? 5,
    lockMinutes: env.AUTH_LOCK_MINUTES ?? 15,
    enforceMfaAllAdmins: env.AUTH_ENFORCE_MFA_ALL_ADMINS === 'true',
    requireMfaForLocalLogin: env.AUTH_REQUIRE_MFA_LOCAL_LOGIN === 'true',
  },
  sso: {
    oidcEnabled: env.OIDC_ENABLED === 'true',
    oidcIssuer: trimOrNull(env.OIDC_ISSUER_URL),
    oidcClientId: trimOrNull(env.OIDC_CLIENT_ID),
    oidcClientSecret: trimOrNull(env.OIDC_CLIENT_SECRET),
    oidcRedirectUri: trimOrNull(env.OIDC_REDIRECT_URI),
    oidcScope: env.OIDC_SCOPE || 'openid profile email',
    oidcAcrValues: trimOrNull(env.OIDC_ACR_VALUES),
    samlEnabled: env.SAML_ENABLED === 'true',
    samlTrustedHeaderUser: env.SAML_TRUSTED_HEADER_USER || 'x-sso-user',
    samlTrustedHeaderEmail: env.SAML_TRUSTED_HEADER_EMAIL || 'x-sso-email',
    samlTrustedHeaderNameId: env.SAML_TRUSTED_HEADER_NAMEID || 'x-sso-nameid',
    samlTrustedProxySecret: trimOrNull(env.SAML_TRUSTED_PROXY_SECRET),
  },
  agent: {
    registrationToken: env.AGENT_REGISTRATION_TOKEN,
    requestSigningRequired:
      derivedEnv === 'production'
        ? env.AGENT_REQUEST_SIGNING_REQUIRED !== 'false'
        : env.AGENT_REQUEST_SIGNING_REQUIRED === 'true',
    requestSigningMaxSkewSeconds: env.AGENT_REQUEST_SIGNING_MAX_SKEW_SECONDS ?? 300,
    nonceStore:
      env.AGENT_NONCE_STORE === 'memory'
        ? 'memory'
        : env.AGENT_NONCE_STORE === 'redis'
          ? 'redis'
          : 'mysql',
    keyPepper: trimOrNull(env.AGENT_KEY_PEPPER),
  },
  ingest: {
    key: trimOrNull(env.XDR_INGEST_KEY),
    queueFirst: env.INGEST_QUEUE_FIRST !== 'false',
  },
  responseApprovals: {
    requireJustificationForHighRisk: env.RESPONSE_APPROVAL_REQUIRE_JUSTIFICATION_FOR_HIGH_RISK !== 'false',
    minJustificationLength: env.RESPONSE_APPROVAL_MIN_JUSTIFICATION_LENGTH ?? 8,
  },
  notifications: {
    inApp: env.NOTIFICATIONS_IN_APP !== 'false',
  },
  audit: {
    archivePath: trimOrNull(env.AUDIT_ARCHIVE_PATH),
    archiveHmacKey: trimOrNull(env.AUDIT_ARCHIVE_HMAC_KEY),
    failureLogPath: trimOrNull(env.AUDIT_FAILURE_LOG_PATH),
  },
  redis: {
    url: trimOrNull(env.REDIS_URL),
    host: env.REDIS_HOST || 'localhost',
    port: env.REDIS_PORT ?? 6379,
    password: env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: splitCsv(env.KAFKA_BROKERS || 'localhost:9092'),
    clientId: env.KAFKA_CLIENT_ID || 'ironshield-edr',
    enabled: env.KAFKA_ENABLED === 'true',
    topics: {
      rawEndpoint: env.KAFKA_TOPIC_RAW_ENDPOINT || 'xdr.raw.endpoint',
      rawWeb: env.KAFKA_TOPIC_RAW_WEB || 'xdr.raw.web',
      rawAuth: env.KAFKA_TOPIC_RAW_AUTH || 'xdr.raw.auth',
      rawZeek: env.KAFKA_TOPIC_RAW_ZEEK || 'xdr.raw.zeek',
      normalized: env.KAFKA_TOPIC_NORMALIZED || 'xdr.normalized',
      detections: env.KAFKA_TOPIC_DETECTIONS || 'xdr.detections',
    },
    groupId: env.KAFKA_GROUP_ID || 'ironshield-workers',
  },
};
