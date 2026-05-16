const test = require('node:test');
const { execSync } = require('child_process');
const path = require('path');

test('openapi documents registered express routes', () => {
  const script = path.join(__dirname, '..', 'scripts', 'validate-openapi-coverage.js');
  execSync(`node "${script}"`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    env: {
      ...process.env,
      OPENAPI_COVERAGE_ALLOWLIST: process.env.OPENAPI_COVERAGE_ALLOWLIST || '',
    },
  });
});
