const test = require('node:test');
const assert = require('node:assert/strict');
const { envelopeResponseMiddleware, isEnveloped } = require('../src/middleware/envelopeResponse');

test('isEnveloped recognizes standard envelope', () => {
  assert.equal(isEnveloped({ success: true, data: { x: 1 } }), true);
  assert.equal(isEnveloped({ success: false, error: { message: 'x' } }), true);
  assert.equal(isEnveloped({ foo: 1 }), false);
  assert.equal(isEnveloped(null), false);
});

test('envelopeResponseMiddleware wraps plain success body', () => {
  const req = { requestId: 'req-test-1' };
  let captured;
  const res = {
    statusCode: 200,
    json(body) {
      captured = body;
      return body;
    },
  };
  res.json = res.json.bind(res);

  envelopeResponseMiddleware(req, res, () => {
    res.json({ items: [1, 2] });
    assert.equal(captured.success, true);
    assert.deepEqual(captured.data, { items: [1, 2] });
    assert.equal(captured.requestId, 'req-test-1');
  });
});

test('envelopeResponseMiddleware wraps error body', () => {
  const req = { headers: {} };
  let captured;
  const res = {
    statusCode: 403,
    json(body) {
      captured = body;
      return body;
    },
  };
  res.json = res.json.bind(res);

  envelopeResponseMiddleware(req, res, () => {
    res.json({ error: 'Forbidden' });
    assert.equal(captured.success, false);
    assert.equal(captured.error.message, 'Forbidden');
    assert.equal(captured.error.code, 'REQUEST_FAILED');
  });
});

test('envelopeResponseMiddleware passes through already enveloped body', () => {
  const req = { headers: {} };
  let captured;
  const res = {
    statusCode: 200,
    json(body) {
      captured = body;
      return body;
    },
  };
  res.json = res.json.bind(res);
  const existing = { success: true, data: { ok: true }, requestId: 'keep-me' };

  envelopeResponseMiddleware(req, res, () => {
    res.json(existing);
    assert.strictEqual(captured, existing);
  });
});
