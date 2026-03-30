const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/utils/db');
const AvSignatureService = require('../src/modules/antivirus/avSignatureService');
const FileReputationService = require('../src/modules/antivirus/fileReputationService');

const sampleHash = 'a'.repeat(64);

test('getReputation returns null for invalid sha256', async () => {
  assert.equal(await FileReputationService.getReputation(null), null);
  assert.equal(await FileReputationService.getReputation(''), null);
});

test('getReputation returns malicious when signature matches', async () => {
  const origLookup = AvSignatureService.lookupHash;
  AvSignatureService.lookupHash = async () => ({
    name: 'TestSig',
    family: 'unit',
    severity: 'high',
  });
  try {
    const out = await FileReputationService.getReputation(sampleHash);
    assert.equal(out.sha256, sampleHash);
    assert.equal(out.reputation, 'malicious');
    assert.equal(out.source, 'signature');
    assert.equal(out.signature_name, 'TestSig');
  } finally {
    AvSignatureService.lookupHash = origLookup;
  }
});

test('getReputation returns unknown when no signature and no scan rows', async () => {
  const origLookup = AvSignatureService.lookupHash;
  const origQuery = db.query;
  AvSignatureService.lookupHash = async () => null;
  db.query = async (sql) => {
    if (String(sql).includes('COUNT(*)')) {
      return [[{ c: 0, endpoints: 0, first_seen: null, last_seen: null }]];
    }
    return [[]];
  };
  try {
    const out = await FileReputationService.getReputation(sampleHash);
    assert.equal(out.reputation, 'unknown');
    assert.equal(out.detection_count, 0);
  } finally {
    AvSignatureService.lookupHash = origLookup;
    db.query = origQuery;
  }
});

test('getReputation uses scan_history when detections exist', async () => {
  const origLookup = AvSignatureService.lookupHash;
  const origQuery = db.query;
  AvSignatureService.lookupHash = async () => null;
  let call = 0;
  db.query = async (sql) => {
    call++;
    if (String(sql).includes('COUNT(*)')) {
      return [[{ c: 3, endpoints: 2, first_seen: new Date('2020-01-01'), last_seen: new Date('2020-06-01') }]];
    }
    if (String(sql).includes('FIELD(severity')) {
      return [[{ severity: 'high' }]];
    }
    return [[]];
  };
  try {
    const out = await FileReputationService.getReputation(sampleHash);
    assert.equal(out.source, 'scan_history');
    assert.equal(out.detection_count, 3);
    assert.equal(out.endpoint_count, 2);
    assert.equal(out.reputation, 'malicious');
    assert.ok(call >= 2);
  } finally {
    AvSignatureService.lookupHash = origLookup;
    db.query = origQuery;
  }
});
