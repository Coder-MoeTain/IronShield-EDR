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
          JWT_SECRET: 'change-me',
          DB_PASSWORD: 'secret',
          METRICS_TOKEN: 'metrics-tok',
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
          JWT_SECRET: 'short',
          DB_PASSWORD: 'secret',
          METRICS_TOKEN: 'metrics-tok',
        },
        'production'
      ),
    /at least 32/
  );
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
