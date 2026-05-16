const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEnv } = require('../src/config/schema');

const baseEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'u',
  DB_NAME: 'd',
  JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz012345',
  AGENT_REGISTRATION_TOKEN: 'break-glass-token-min-24-chars!!',
};

const productionExtras = {
  DB_PASSWORD: 'secret',
  METRICS_TOKEN: 'metrics-token-32chars-minimum!!',
  AGENT_KEY_PEPPER: 'production-pepper-32chars-minimum',
  TLS_ENABLED: 'true',
  AGENT_MTLS_REQUIRED: 'true',
  CORS_ORIGINS: 'https://soc.example.com',
};

test('parseEnv accepts valid development config', () => {
  const p = parseEnv({ ...baseEnv, DB_PASSWORD: 'pw' }, 'development');
  assert.equal(p.DB_HOST, 'localhost');
});

test('parseEnv rejects missing DB_HOST', () => {
  const env = { ...baseEnv };
  delete env.DB_HOST;
  assert.throws(() => parseEnv(env, 'development'), /Invalid configuration/);
});

test('parseEnv rejects weak JWT in production', () => {
  assert.throws(
    () =>
      parseEnv(
        {
          ...baseEnv,
          ...productionExtras,
          JWT_SECRET: 'change-me',
        },
        'production'
      ),
    /JWT_SECRET/
  );
});

test('parseEnv rejects short JWT in production', () => {
  assert.throws(
    () =>
      parseEnv(
        {
          ...baseEnv,
          ...productionExtras,
          JWT_SECRET: 'short',
        },
        'production'
      ),
    /at least 32/
  );
});

test('parseEnv rejects wildcard CORS in production', () => {
  assert.throws(
    () =>
      parseEnv(
        {
          ...baseEnv,
          ...productionExtras,
          CORS_ORIGINS: '*',
        },
        'production'
      ),
    /CORS/
  );
});

test('parseEnv accepts hardened production config', () => {
  const p = parseEnv({ ...baseEnv, ...productionExtras }, 'production');
  assert.equal(p.TLS_ENABLED, 'true');
});

test('CONFIG_SKIP_PRODUCTION_SECRET_CHECK bypasses weak secret check', () => {
  const p = parseEnv(
    {
      ...baseEnv,
      JWT_SECRET: 'change-me',
      DB_PASSWORD: 'x',
      METRICS_TOKEN: 'm',
      CONFIG_SKIP_PRODUCTION_SECRET_CHECK: 'true',
    },
    'production'
  );
  assert.equal(p.JWT_SECRET, 'change-me');
});
