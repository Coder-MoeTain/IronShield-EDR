const test = require('node:test');
const assert = require('node:assert/strict');

test('production score caps below 90 when critical agent trust fails in production', async () => {
  const config = require('../src/config');
  const ProductionReadinessService = require('../src/services/ProductionReadinessService');
  const prevEnv = config.env;
  const prevMtls = config.tls?.agentMtlsRequired;
  const prevSigning = config.agent?.requestSigningRequired;
  const prevPepper = config.agent?.keyPepper;

  config.env = 'production';
  config.tls.agentMtlsRequired = false;
  config.agent.requestSigningRequired = false;
  config.agent.keyPepper = null;

  try {
    const data = await ProductionReadinessService.getScore();
    if (data.score >= 90) {
      assert.equal(data.capped, true);
      assert.ok(data.critical_failed?.length > 0);
      assert.equal(data.score, 89);
    }
  } finally {
    config.env = prevEnv;
    config.tls.agentMtlsRequired = prevMtls;
    config.agent.requestSigningRequired = prevSigning;
    config.agent.keyPepper = prevPepper;
  }
});

test.after(async () => {
  const db = require('../src/utils/db');
  await db.closePool().catch(() => {});
});
