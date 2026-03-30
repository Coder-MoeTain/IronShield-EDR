/**
 * Phase 4 — heartbeat body accepts sensor telemetry fields (Zod contract).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { heartbeatSchema } = require('../src/schemas/agentSchemas');

test('heartbeatSchema accepts Phase 4 sensor telemetry fields', () => {
  const body = {
    queue_depth: 1200,
    process_uptime_seconds: 86400,
    host_isolation_active: false,
    sensor_operational_status: 'ok',
  };
  const parsed = heartbeatSchema.safeParse({ body });
  assert.equal(parsed.success, true, parsed.success ? '' : JSON.stringify(parsed.error?.format()));
  assert.equal(parsed.data.body.queue_depth, 1200);
  assert.equal(parsed.data.body.process_uptime_seconds, 86400);
  assert.equal(parsed.data.body.host_isolation_active, false);
  assert.equal(parsed.data.body.sensor_operational_status, 'ok');
});

test('heartbeatSchema accepts degraded and nullish telemetry', () => {
  const parsed = heartbeatSchema.safeParse({
    body: {
      sensor_operational_status: 'degraded',
      queue_depth: null,
      process_uptime_seconds: undefined,
    },
  });
  assert.equal(parsed.success, true);
});
