const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const configPath = path.resolve(__dirname, '../src/config/index.js');
const jwtVerifyPath = path.resolve(__dirname, '../src/utils/jwtVerify.js');

function withFreshModules(env, fn) {
  const original = { ...process.env };
  Object.assign(process.env, env);
  delete require.cache[configPath];
  delete require.cache[jwtVerifyPath];
  try {
    return fn(require('../src/utils/jwtVerify'));
  } finally {
    process.env = original;
    delete require.cache[configPath];
    delete require.cache[jwtVerifyPath];
  }
}

const baseEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'u',
  DB_NAME: 'd',
  JWT_SECRET: 'newsecret',
  AGENT_REGISTRATION_TOKEN: 't',
};

test('verifyWithRotation accepts access tokens signed with JWT_SECRET_PREVIOUS', () => {
  withFreshModules(
    {
      ...baseEnv,
      JWT_SECRET_PREVIOUS: 'oldsecret',
    },
    ({ verifyWithRotation }) => {
      const token = jwt.sign({ userId: 42 }, 'oldsecret', { expiresIn: '1h' });
      const decoded = verifyWithRotation(token);
      assert.equal(decoded.userId, 42);
    }
  );
});

test('verifyWithRotation accepts tokens signed with primary JWT_SECRET', () => {
  withFreshModules(baseEnv, ({ verifyWithRotation }) => {
    const token = jwt.sign({ userId: 99 }, 'newsecret', { expiresIn: '1h' });
    const decoded = verifyWithRotation(token);
    assert.equal(decoded.userId, 99);
  });
});

test('verifyWithRotation rejects garbage tokens', () => {
  withFreshModules(baseEnv, ({ verifyWithRotation }) => {
    assert.throws(() => verifyWithRotation('not.a.jwt'), /jwt|json/i);
  });
});
