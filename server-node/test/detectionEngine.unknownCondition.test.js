const test = require('node:test');
const assert = require('node:assert/strict');

const { matchesRule } = require('../src/services/DetectionEngineService');

test('unknown condition keys do not match (fail-closed)', () => {
  const rule = {
    conditions: { not_a_real_engine_key: true },
    title: 'bad rule',
    name: 'bad',
  };
  const norm = {
    event_type: 'process_create',
    process_name: 'malware.exe',
    command_line: '',
  };
  assert.equal(matchesRule(rule, norm), false);
});

test('valid condition keys still match when criteria met', () => {
  const rule = {
    conditions: { process_name: 'malware.exe' },
    title: 'ok',
    name: 'ok',
  };
  const norm = { event_type: 'process_create', process_name: 'malware.exe' };
  assert.equal(matchesRule(rule, norm), true);
});
