const test = require('node:test');
const assert = require('node:assert/strict');
const MitreCoverageService = require('../src/services/MitreCoverageService');
const DetectionCodeEngine = require('../src/services/DetectionCodeEngine');

test('getCoverage includes code rules from disk', async () => {
  const codeRules = DetectionCodeEngine.loadRulesFromDisk();
  assert.ok(codeRules.length >= 3, 'expected detection-as-code pack on disk');
  const coverage = await MitreCoverageService.getCoverage(null);
  assert.ok(coverage.summary);
  assert.ok(Array.isArray(coverage.tactics));
  assert.ok(coverage.summary.total_techniques >= 1);
});
