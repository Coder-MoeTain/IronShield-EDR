/**
 * HMAC signatures for response actions dispatched to agents.
 */
const crypto = require('crypto');
const config = require('../config');

function getSecret() {
  return (
    process.env.RESPONSE_COMMAND_HMAC_KEY ||
    config.jwt?.secret ||
    ''
  );
}

function signAction(actionRow, agentKey = null) {
  const secret = agentKey || getSecret();
  if (!secret) return null;

  const expiresAt =
    actionRow.expires_at ||
    new Date(Date.now() + (Number(process.env.RESPONSE_COMMAND_TTL_SEC || 3600) * 1000)).toISOString();

  const payload = [
    actionRow.id,
    actionRow.endpoint_id,
    actionRow.action_type,
    expiresAt,
    JSON.stringify(actionRow.parameters ?? {}),
  ].join('\n');

  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  return {
    command_signature: signature,
    command_expires_at: expiresAt,
    command_payload_version: '1',
  };
}

function verifyAction(actionRow, signature, expiresAt, agentKey = null) {
  if (!signature) return { ok: false, reason: 'missing_signature' };
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  const expected = signAction({ ...actionRow, expires_at: expiresAt }, agentKey);
  if (!expected?.command_signature) return { ok: false, reason: 'no_signing_key' };
  const a = Buffer.from(String(signature), 'hex');
  const b = Buffer.from(expected.command_signature, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}

module.exports = { signAction, verifyAction };
