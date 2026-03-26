const test = require('node:test');
const assert = require('node:assert/strict');

const { validateReleaseInput } = require('../src/controllers/phase6Controller');

test('validateReleaseInput accepts enterprise-safe release payload', () => {
  const err = validateReleaseInput({
    version: '1.2.3',
    download_url: 'https://downloads.example.com/agent-1.2.3.bin',
    checksum_sha256: 'a'.repeat(64),
  });
  assert.equal(err, null);
});

test('validateReleaseInput rejects non-https download url', () => {
  const err = validateReleaseInput({
    version: '1.2.3',
    download_url: 'http://downloads.example.com/agent-1.2.3.bin',
    checksum_sha256: 'a'.repeat(64),
  });
  assert.match(err, /download_url must be https/i);
});

test('validateReleaseInput rejects invalid checksum', () => {
  const err = validateReleaseInput({
    version: '1.2.3',
    download_url: 'https://downloads.example.com/agent-1.2.3.bin',
    checksum_sha256: '1234',
  });
  assert.match(err, /checksum_sha256/i);
});

