const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const configPath = path.resolve(__dirname, '../src/config/index.js');

function loadConfigWithEnv(overrides) {
  const original = { ...process.env };
  Object.assign(process.env, overrides);
  delete require.cache[configPath];
  const cfg = require('../src/config');
  process.env = original;
  delete require.cache[configPath];
  return cfg;
}

test('security enforcement defaults are enabled', () => {
  const cfg = loadConfigWithEnv({
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'u',
    DB_NAME: 'd',
    JWT_SECRET: 's',
    AGENT_REGISTRATION_TOKEN: 't',
    ENFORCE_TLS_IN_PRODUCTION: 'true',
    ENFORCE_AGENT_MTLS_IN_PRODUCTION: 'true',
  });
  assert.equal(cfg.security.enforceTlsInProduction, true);
  assert.equal(cfg.security.enforceAgentMtlsInProduction, true);
});

test('JWT_SECRET_PREVIOUS is optional (null when unset)', () => {
  const cfg = loadConfigWithEnv({
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'u',
    DB_NAME: 'd',
    JWT_SECRET: 's',
    AGENT_REGISTRATION_TOKEN: 't',
  });
  assert.equal(cfg.jwt.secretPrevious, null);
});

test('JWT_SECRET_PREVIOUS is read when set', () => {
  const cfg = loadConfigWithEnv({
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'u',
    DB_NAME: 'd',
    JWT_SECRET: 's',
    JWT_SECRET_PREVIOUS: 'prev',
    AGENT_REGISTRATION_TOKEN: 't',
  });
  assert.equal(cfg.jwt.secretPrevious, 'prev');
});

