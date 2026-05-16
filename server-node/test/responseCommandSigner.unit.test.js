const test = require('node:test');
const assert = require('node:assert/strict');
const { signAction, verifyAction } = require('../src/services/ResponseCommandSigner');

test('signAction with agent key produces verifiable signature', () => {
  const row = {
    id: 42,
    endpoint_id: 7,
    action_type: 'kill_process',
    parameters: { process_id: 1234 },
  };
  const agentKey = 'test-agent-key-for-hmac-signing';
  const sig = signAction(row, agentKey);
  assert.ok(sig?.command_signature);
  const check = verifyAction(
    { ...row, expires_at: sig.command_expires_at },
    sig.command_signature,
    sig.command_expires_at,
    agentKey
  );
  assert.equal(check.ok, true);
});

test('verifyAction rejects tampered signature', () => {
  const row = { id: 1, endpoint_id: 2, action_type: 'isolate_host', parameters: {} };
  const sig = signAction(row, 'secret-key-32chars-minimum!!!!!');
  const check = verifyAction(row, '00'.repeat(32), sig.command_expires_at, 'secret-key-32chars-minimum!!!!!');
  assert.equal(check.ok, false);
});
