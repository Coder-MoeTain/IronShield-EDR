const test = require('node:test');
const assert = require('node:assert/strict');

const AgentUpdateService = require('../src/services/AgentUpdateService');
const db = require('../src/utils/db');

test('parseVersion handles prerelease and leading v', () => {
  assert.deepEqual(AgentUpdateService._parseVersion('v1.2.3-beta.1'), [1, 2, 3]);
  assert.deepEqual(AgentUpdateService._parseVersion('2.0.1'), [2, 0, 1]);
});

test('isNewer compares semantic versions safely', () => {
  assert.equal(AgentUpdateService._isNewer('1.2.3', '1.2.4'), true);
  assert.equal(AgentUpdateService._isNewer('1.2.3', '1.2.3'), false);
  assert.equal(AgentUpdateService._isNewer('2.0.0', '1.9.9'), false);
});

test('isValidReleaseForDelivery enforces https + checksum + semver', () => {
  assert.equal(
    AgentUpdateService._isValidReleaseForDelivery({
      version: '1.2.3',
      download_url: 'https://dl.example.com/agent.bin',
      checksum_sha256: 'a'.repeat(64),
    }),
    true
  );
  assert.equal(
    AgentUpdateService._isValidReleaseForDelivery({
      version: '1.2.3',
      download_url: 'http://dl.example.com/agent.bin',
      checksum_sha256: 'a'.repeat(64),
    }),
    false
  );
});

test('checkUpdate does not offer invalid release metadata', async () => {
  const original = db.queryOne;
  db.queryOne = async () => ({
    version: '1.2.4',
    download_url: 'http://dl.example.com/agent.bin',
    checksum_sha256: 'bad',
    ring: 'stable',
  });
  try {
    const res = await AgentUpdateService.checkUpdate('1.2.3', { ring: 'stable' });
    assert.equal(res.update_available, false);
    assert.equal(res.reason, 'invalid_release_metadata');
  } finally {
    db.queryOne = original;
  }
});

