/**
 * Software risk management unit tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { matchesExpression, compareVersions } = require('../src/modules/software/versionMatcher');
const { calculateRiskScore } = require('../src/modules/software/softwareRiskService');
const { computeFingerprint, normalizeName } = require('../src/modules/software/softwareNormalize');

describe('versionMatcher', () => {
  it('compares semantic versions', () => {
    assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
    assert.equal(compareVersions('2.0.0', '1.0.0'), 1);
  });

  it('matches less-than expression', () => {
    const r = matchesExpression('124.0.0.0', '<125.0.0.0');
    assert.equal(r.match, true);
    assert.equal(r.needsReview, false);
  });

  it('marks unparseable as needs review', () => {
    const r = matchesExpression('', '<125.0.0.0');
    assert.equal(r.needsReview, true);
  });
});

describe('softwareRiskService', () => {
  it('scores critical CVE', () => {
    const result = calculateRiskScore(
      { name: 'Google Chrome', version: '124.0.0.0' },
      [{ severity: 'critical', exploit_known: true, cve_id: 'CVE-DEMO-0001' }],
      { criticalEndpoint: true }
    );
    assert.ok(result.risk_score >= 81);
    assert.equal(result.risk_level, 'critical');
    assert.ok(result.reasons.length > 0);
  });

  it('returns none for clean software', () => {
    const result = calculateRiskScore({ name: 'App', version: '2.0' }, [], {});
    assert.equal(result.risk_level, 'none');
  });
});

describe('softwareNormalize', () => {
  it('normalizes names', () => {
    assert.equal(normalizeName('Google Chrome'), 'google chrome');
  });

  it('computes stable fingerprint', () => {
    const a = computeFingerprint({
      name: 'Chrome',
      vendor: 'Google',
      version: '1.0',
      installLocation: 'C:\\Program Files\\Chrome',
      endpointId: 1,
    });
    const b = computeFingerprint({
      name: 'Chrome',
      vendor: 'Google',
      version: '1.0',
      installLocation: 'C:\\Program Files\\Chrome',
      endpointId: 1,
    });
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });
});
