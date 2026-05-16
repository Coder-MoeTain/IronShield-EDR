/**
 * Agent key hashing (HMAC-SHA256 with server pepper). Raw keys are never stored after migration.
 */
const crypto = require('crypto');
const config = require('../config');

function getPepper() {
  const pepper = config.agent?.keyPepper || process.env.AGENT_KEY_PEPPER;
  if (!pepper || String(pepper).trim().length < 16) {
    if (config.env === 'production') {
      throw new Error('AGENT_KEY_PEPPER must be set (≥16 chars) in production');
    }
    return 'dev-agent-key-pepper-not-for-production';
  }
  return String(pepper).trim();
}

function hashAgentKey(rawKey) {
  if (!rawKey) return null;
  return crypto.createHmac('sha256', getPepper()).update(String(rawKey), 'utf8').digest('hex');
}

function generateRawKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashAgentKey, generateRawKey, getPepper };
