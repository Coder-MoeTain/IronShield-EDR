const test = require('node:test');
const assert = require('node:assert/strict');
const { ERROR_CODES, HttpError, sendSuccess, sendError } = require('../src/utils/apiResponse');
const { hasPermission: checkPerm, hasAnyPermission } = require('../src/constants/permissions');

function mkRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
  };
}

test('sendSuccess envelope', () => {
  const res = mkRes();
  sendSuccess(res, { id: 1 }, { meta: { total: 1 }, requestId: 'req-1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, { id: 1 });
  assert.equal(res.body.meta.total, 1);
  assert.equal(res.body.requestId, 'req-1');
});

test('sendError envelope', () => {
  const res = mkRes();
  sendError(res, ERROR_CODES.VALIDATION_ERROR, 'Bad input', {
    status: 400,
    details: [{ path: 'body.email' }],
    requestId: 'req-2',
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, ERROR_CODES.VALIDATION_ERROR);
  assert.equal(res.body.error.message, 'Bad input');
  assert.equal(res.body.requestId, 'req-2');
});

test('HttpError carries code and status', () => {
  const err = new HttpError(403, ERROR_CODES.PERMISSION_DENIED, 'Nope');
  assert.equal(err.statusCode, 403);
  assert.equal(err.code, ERROR_CODES.PERMISSION_DENIED);
});

test('hasPermission maps legacy actions:write to response:execute', () => {
  assert.equal(checkPerm(['actions:write'], 'response:execute'), true);
  assert.equal(checkPerm(['response:execute'], 'actions:write'), true);
});

test('hasAnyPermission with wildcard', () => {
  assert.equal(hasAnyPermission(['*'], ['tenant:manage']), true);
});
