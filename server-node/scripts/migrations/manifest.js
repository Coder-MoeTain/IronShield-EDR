/**
 * Ordered migration manifest (Phase 2 runner).
 * Legacy entries run existing idempotent scripts; module entries export { up, down? }.
 */
const path = require('path');

const LEGACY_DIR = path.join(__dirname, '..');

const LEGACY_SCRIPTS = [
  'migrate-phase5-endpoints-tenant.js',
  'migrate-detection-rules-tenant.js',
  'migrate-endpoint-metrics.js',
  'migrate-sensor-telemetry.js',
  'migrate-endpoint-host-inventory.js',
  'migrate-endpoint-hidden-c.js',
  'migrate-endpoint-disk-usage.js',
  'migrate-tamper-signals.js',
  'migrate-av-realtime-debounce.js',
  'migrate-av-device-control.js',
  'migrate-av-ransomware-protection.js',
  'migrate-av-web-url-protection.js',
  'migrate-phase6-agent-update-telemetry.js',
  'migrate-agent-release-signatures.js',
  'migrate-phase7-ngav-telemetry.js',
  'migrate-phase8-edr-policy-sync.js',
  'migrate-triage-core.js',
  'migrate-investigations-core.js',
  'migrate-policy-network-baseline.js',
  'migrate-normalized-events-parity.js',
  'migrate-falcon-ui-pack.js',
  'migrate-capabilities-v2.js',
  'migrate-cs-parity.js',
  'migrate-xdr-events.js',
  'migrate-xdr-detections.js',
  'migrate-xdr-incident-links.js',
  'migrate-xdr-autoresponse.js',
  'migrate-xdr-ip-feeds.js',
  'migrate-user-saved-views.js',
  'migrate-enrollment-tokens.js',
  'migrate-agent-key-lifecycle.js',
  'migrate-agent-batch-dedupe.js',
  'migrate-agent-event-idempotency.js',
  'migrate-response-action-approvals.js',
  'migrate-agent-release-rollouts.js',
  'migrate-soc-hardening.js',
  'migrate-audit-logs.js',
  'migrate-audit-hashchain.js',
];

function legacyId(scriptName) {
  return `legacy_${scriptName.replace(/\.js$/, '')}`;
}

const manifest = [
  {
    id: '000_schema_migrations',
    description: 'Migration tracking table',
    module: path.join(__dirname, '000_schema_migrations.js'),
  },
  ...LEGACY_SCRIPTS.map((script) => ({
    id: legacyId(script),
    description: script,
    legacyScript: path.join(LEGACY_DIR, script),
  })),
  {
    id: '20260516120000_phase2_tenant_isolation',
    description: 'tenant_id on events/alerts; agent_nonces; approved_scripts; detection_rule_versions',
    module: path.join(__dirname, '20260516120000_phase2_tenant_isolation.js'),
  },
  {
    id: '20260516120100_phase2_enterprise_permissions',
    description: 'Seed enterprise permission names and role links',
    module: path.join(__dirname, '20260516120100_phase2_enterprise_permissions.js'),
  },
  {
    id: '20260516200000_phases3_9_schema',
    description: 'Phases 3-9: enrollment single-use, alert evidence, integrations, reports',
    module: path.join(__dirname, '20260516200000_phases3_9_schema.js'),
  },
  {
    id: '20260517120000_production_hardening',
    description: 'Production hardening: agent_key_hash, cert binding, alert breakdown',
    module: path.join(__dirname, '20260517120000_production_hardening.js'),
  },
  {
    id: '20260518120000_enterprise_pilot_hardening',
    description: 'Enterprise pilot: nonces, alert evidence, incidents, RTR, trust metrics',
    module: path.join(__dirname, '20260518120000_enterprise_pilot_hardening.js'),
  },
];

module.exports = { manifest, LEGACY_DIR };
