/**
 * Software risk management unit tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { matchesExpression, compareVersions } = require('../src/modules/software/versionMatcher');
const { calculateRiskScore } = require('../src/modules/software/softwareRiskService');
const { computeFingerprint, normalizeName } = require('../src/modules/software/softwareNormalize');
const {
  isProtectedSoftwareName,
  isDangerousWildcard,
  validateBlockPolicy,
} = require('../src/modules/software/softwareBlockSafety');
const { requiresBlockApproval } = require('../src/modules/software/softwareRemediationService');
const SoftwareReportService = require('../src/modules/software/softwareReportService');

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

  it('matches greater-than and equals', () => {
    assert.equal(matchesExpression('2.0.0', '>=2.0.0').match, true);
    assert.equal(matchesExpression('2.0.0', '>2.0.0').match, false);
    assert.equal(matchesExpression('2.0.0', '=2.0.0').match, true);
  });

  it('matches range expression', () => {
    const r = matchesExpression('3.0.0', 'range: >=3.0.0 <4.0.0');
    assert.equal(r.match, true);
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

describe('softwareBlockSafety', () => {
  it('rejects protected process names', () => {
    assert.equal(isProtectedSoftwareName('lsass'), true);
    assert.equal(isProtectedSoftwareName('IronShield.Agent.Service'), true);
    assert.equal(isProtectedSoftwareName('Notepad'), false);
  });

  it('flags dangerous wildcards', () => {
    assert.equal(isDangerousWildcard({ executable_path_pattern: '*' }), true);
    assert.equal(
      isDangerousWildcard({ executable_path_pattern: 'C:\\Program Files\\Vendor\\Application\\*.exe' }),
      false
    );
  });

  it('validates block policy', () => {
    const bad = validateBlockPolicy({ software_name: 'lsass' });
    assert.equal(bad.valid, false);
    const ok = validateBlockPolicy({ software_name: 'OldApp' });
    assert.equal(ok.valid, true);
  });

  it('requires super_admin for broad wildcard', () => {
    const r = validateBlockPolicy({ executable_path_pattern: '*' }, { isSuperAdmin: false });
    assert.equal(r.valid, false);
    const r2 = validateBlockPolicy({ executable_path_pattern: '*' }, { isSuperAdmin: true });
    assert.equal(r2.valid, true);
  });
});

describe('requiresBlockApproval', () => {
  it('requires approval for browser blocks', () => {
    assert.equal(requiresBlockApproval({ software_name: 'Google Chrome' }), true);
  });
});

describe('softwareVulnerabilityService', () => {
  const SoftwareVulnerabilityService = require('../src/modules/software/softwareVulnerabilityService');

  it('importBatch skips invalid CVE records', async () => {
    const result = await SoftwareVulnerabilityService.importBatch(
      [{ cve_id: 'NOT-A-CVE', normalized_name: 'demo-app', severity: 'high' }],
      'unit-test'
    );
    assert.equal(result.imported, 0);
    assert.equal(result.skipped, 1);
  });
});

describe('softwareReportService', () => {
  it('exports CSV header', () => {
    const csv = SoftwareReportService.toCsv({ rows: [] });
    assert.ok(csv.includes('name,vendor'));
  });

  it('lists report types', () => {
    assert.ok(SoftwareReportService.REPORT_TYPES.includes('vulnerable'));
  });
});
