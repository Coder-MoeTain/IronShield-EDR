/**
 * IronShield EDR Platform - Configuration
 */
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'edr_user',
    password: process.env.DB_PASSWORD ?? 'edr_password',
    database: process.env.DB_NAME || 'edr_platform',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  agent: {
    registrationToken: process.env.AGENT_REGISTRATION_TOKEN || 'change-this-registration-token',
  },
  notifications: {
    inApp: process.env.NOTIFICATIONS_IN_APP !== 'false',
  },
  redis: {
    url: process.env.REDIS_URL || null,
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
    key: process.env.XDR_INGEST_KEY || null,
  },
};
