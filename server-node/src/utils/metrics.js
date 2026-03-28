/**
 * Central metrics registry (Prometheus).
 * Safe to require even when metrics are disabled; increments become no-ops.
 */
const promClient = require('prom-client');
const config = require('../config');
const logger = require('./logger');

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

function gauge(name, help) {
  if (!enabled) return { set: () => {} };
  try {
    return new promClient.Gauge({ name, help });
  } catch {
    return promClient.register.getSingleMetric(name) || { set: () => {} };
  }
}

/** SOC readiness snapshot (same source as GET /api/admin/soc/readiness, tenant scope = platform). */
const socEndpointsTotal = gauge(
  'ironshield_soc_endpoints_total',
  'Endpoints in scope (SOC readiness)'
);
const socEndpointsOnline15m = gauge(
  'ironshield_soc_endpoints_online_15m',
  'Endpoints with heartbeat in the last 15 minutes'
);
const socAlertsOpen = gauge(
  'ironshield_soc_alerts_open',
  'Alerts in new or investigating status'
);
const socDetectionRulesEnabled = gauge(
  'ironshield_soc_detection_rules_enabled',
  'Enabled detection (IOA) rules count'
);
const socTamperHighHosts = gauge(
  'ironshield_soc_tamper_high_hosts',
  'Endpoints with tamper_risk=high (-1 if unavailable / not migrated)'
);
const socIngestAsyncQueue = gauge(
  'ironshield_soc_ingest_async_queue_enabled',
  '1 if BullMQ async ingest is configured (REDIS_URL/REDIS_HOST), else 0'
);
const socKafkaIngest = gauge(
  'ironshield_soc_kafka_ingest_enabled',
  '1 if Kafka ingest is enabled in config, else 0'
);
const socReadinessTimestampSeconds = gauge(
  'ironshield_soc_readiness_timestamp_seconds',
  'Unix seconds when SOC readiness snapshot was generated (best-effort)'
);

/**
 * Refresh SOC gauges from DB (called before Prometheus scrape output).
 * Failures are logged; existing gauge values may remain from last successful refresh.
 */
async function refreshSocReadinessGauges() {
  if (!enabled) return;
  try {
    const SocReadinessService = require('../services/SocReadinessService');
    const data = await SocReadinessService.getReadiness(null);
    socEndpointsTotal.set(data.endpoints_total ?? 0);
    socEndpointsOnline15m.set(data.endpoints_online_15m ?? 0);
    socAlertsOpen.set(data.alerts_open ?? 0);
    socDetectionRulesEnabled.set(data.detection_rules_enabled ?? 0);
    if (data.tamper_high_hosts == null) {
      socTamperHighHosts.set(-1);
    } else {
      socTamperHighHosts.set(data.tamper_high_hosts);
    }
    socIngestAsyncQueue.set(data.ingest_async_queue ? 1 : 0);
    socKafkaIngest.set(data.kafka_ingest ? 1 : 0);
    const t = data.generated_at ? Date.parse(data.generated_at) : NaN;
    socReadinessTimestampSeconds.set(Number.isFinite(t) ? Math.floor(t / 1000) : Date.now() / 1000);
  } catch (err) {
    logger.warn({ err: err?.message }, 'soc_readiness_prometheus_refresh_failed');
  }
}

module.exports = {
  enabled,
  refreshSocReadinessGauges,
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
  alertsCreatedFromDetectionTotal: counter(
    'ironshield_alerts_created_from_detection_total',
    'Alerts inserted after IOA/detection rule matches (EDR pipeline)',
    ['severity']
  ),
};

