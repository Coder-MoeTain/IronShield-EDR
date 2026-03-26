const test = require('node:test');
const assert = require('node:assert/strict');

const DetectionEngineService = require('../src/services/DetectionEngineService');

test('matchesRule detects encoded powershell command', () => {
  const rule = {
    conditions: {
      process_name: 'powershell.exe',
      encoded_command: true,
    },
  };
  const evt = {
    process_name: 'powershell.exe',
    command_line: '-enc SQBtAHAAbwByAHQAYQBuAHQ=',
    powershell_command: '',
    event_type: 'process_create',
  };
  assert.equal(DetectionEngineService.matchesRule(rule, evt), true);
});

test('matchesRule detects suspicious service parent process anomaly', () => {
  const rule = {
    conditions: {
      unusual_parent: true,
    },
  };
  const evt = {
    event_type: 'service_create',
    parent_process_name: 'cmd.exe',
    process_name: 'sc.exe',
  };
  assert.equal(DetectionEngineService.matchesRule(rule, evt), true);
});

test('matchesRule negative case for benign event', () => {
  const rule = {
    conditions: {
      process_name: 'powershell.exe',
      encoded_command: true,
    },
  };
  const evt = {
    process_name: 'notepad.exe',
    command_line: 'notepad.exe readme.txt',
    event_type: 'process_create',
  };
  assert.equal(DetectionEngineService.matchesRule(rule, evt), false);
});

