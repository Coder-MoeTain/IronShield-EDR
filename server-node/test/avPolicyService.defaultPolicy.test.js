const test = require('node:test');
const assert = require('node:assert/strict');

const AvPolicyService = require('../src/modules/antivirus/avPolicyService');

test('getDefaultPolicy includes realtime_debounce_seconds', () => {
  const p = AvPolicyService.getDefaultPolicy(null);
  assert.equal(p.realtime_debounce_seconds, 2);
});

test('getDefaultPolicy includes device control defaults', () => {
  const p = AvPolicyService.getDefaultPolicy(null);
  assert.equal(p.device_control_enabled, false);
  assert.equal(p.removable_storage_action, 'audit');
});
