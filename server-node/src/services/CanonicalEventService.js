/**
 * Build canonical events from raw/normalized rows (Phase 4).
 */
const crypto = require('crypto');
const { canonicalEventSchema } = require('../schemas/canonicalEvent');
const EventNormalizationService = require('./EventNormalizationService');

function toIso(v) {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function buildFromNormalized(norm, extras = {}) {
  const raw =
    typeof norm.raw_event_json === 'object'
      ? norm.raw_event_json
      : norm.raw_event_json
        ? JSON.parse(norm.raw_event_json)
        : {};

  const event = {
    event_id: raw.event_id || crypto.randomUUID(),
    tenant_id: extras.tenant_id ?? norm.tenant_id ?? null,
    endpoint_id: norm.endpoint_id,
    event_type: norm.event_type || 'unknown',
    event_time: toIso(norm.timestamp),
    ingested_at: new Date().toISOString(),
    severity: extras.severity || raw.severity || 'info',
    host: {
      hostname: norm.hostname,
      os: raw.os_version,
      ip: norm.source_ip || raw.ip_address,
      agent_version: raw.agent_version,
    },
    user: {
      name: norm.username || raw.user,
      domain: raw.user_domain,
      sid: raw.user_sid,
    },
    process: {
      pid: norm.process_id,
      ppid: norm.parent_process_id,
      name: norm.process_name,
      path: norm.process_path,
      command_line: norm.command_line || norm.powershell_command,
      sha256: norm.file_hash_sha256,
      signed: raw.signed,
      publisher: raw.publisher,
    },
    network: {
      local_ip: norm.source_ip,
      remote_ip: norm.destination_ip,
      remote_port: norm.destination_port,
      protocol: norm.protocol,
      direction: raw.direction,
    },
    file: {
      path: raw.file_path || norm.image_loaded_path,
      sha256: norm.file_hash_sha256,
      operation: raw.file_operation,
    },
    registry: {
      key: norm.registry_key,
      value: norm.registry_value_name,
      operation: raw.registry_operation,
    },
    raw,
  };

  return canonicalEventSchema.parse(event);
}

function normalizeRawToCanonical(rawEvent, tenantId = null) {
  const norm = EventNormalizationService.normalize(rawEvent);
  return buildFromNormalized(norm, { tenant_id: tenantId });
}

module.exports = { buildFromNormalized, normalizeRawToCanonical, canonicalEventSchema };
