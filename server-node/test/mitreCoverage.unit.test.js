const test = require('node:test');
const assert = require('node:assert/strict');
const DetectionCodeEngine = require('../src/services/DetectionCodeEngine');

test('detection-as-code pack loads for MITRE coverage', () => {
  const codeRules = DetectionCodeEngine.loadRulesFromDisk();
  assert.ok(codeRules.length >= 30, 'expected detection-as-code pack on disk');
  const withMitre = codeRules.filter((r) => r.mitre?.techniques?.length);
  assert.ok(withMitre.length >= 1);
});
