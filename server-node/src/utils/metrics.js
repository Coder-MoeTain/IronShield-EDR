/**
 * Central metrics registry (Prometheus).
 * Safe to require even when metrics are disabled; increments become no-ops.
 */
const promClient = require('prom-client');
const config = require('../config');

const enabled = !!config.metrics?.enabled;

function counter(name, help, labelNames = []) {
  if (!enabled) return { inc: () => {} };
  try {
    return new promClient.Counter({ name, help, labelNames });
  } catch {
    // Already registered
    return promClient.register.getSingleMetric(name) || { inc: () => {} };
  }
}

module.exports = {
  enabled,
  agentAuthFailuresTotal: counter(
    'ironshield_agent_auth_failures_total',
    'Agent auth failures total',
    ['reason']
  ),
  agentIngestBatchesTotal: counter(
    'ironshield_agent_ingest_batches_total',
    'Agent event batches ingested',
    ['result']
  ),
  agentIngestEventsTotal: counter(
    'ironshield_agent_ingest_events_total',
    'Agent raw events ingested',
    ['result']
  ),
};

