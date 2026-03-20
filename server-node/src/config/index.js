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
};
