const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ruleReviewService = require('../src/modules/detections/ruleReviewService');
const { importSigmaYaml } = require('../src/modules/detections/sigmaImportService');

describe('ruleReviewService separation of duties', () => {
  it('rejects author approving own stable rule', async () => {
    await assert.rejects(
      () => ruleReviewService.approve('IRN-WIN-0001', '1.0.0', 42, null, 42),
      (err) => err.code === 'SEPARATION_OF_DUTIES'
    );
  });
});

describe('sigma import', () => {
  it('imports as draft-only rule', () => {
    const yaml = `title: Test Sigma Rule
id: test-sigma-001
status: experimental
logsource:
  product: windows
detection:
  selection:
    Image|endswith: '\\evil.exe'
  condition: selection
level: high`;
    const draft = importSigmaYaml(yaml);
    assert.equal(draft.status, 'draft');
    assert.equal(draft.enabled, false);
    assert.equal(draft._sigma_import, true);
  });
});
