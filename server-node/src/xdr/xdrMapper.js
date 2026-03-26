const crypto = require('crypto');
const EventNormalizationService = require('../services/EventNormalizationService');

function mkIngestId() {
  return crypto.randomBytes(12).toString('hex');
}

function toDate(v) {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Map existing normalized_events shape (from EventNormalizationService.normalize(raw_event_row))
 * into canonical XDR event.
 */
function fromLegacyNormalized(norm, { tenantId = null, source = 'endpoint', ingestId = null } = {}) {
  const raw = norm?.raw_event_json || null;
  return {
    tenant_id: tenantId,
    endpoint_id: norm?.endpoint_id ?? null,
    event_id: raw?.event_id ?? norm?.raw_event_id != null ? String(norm.raw_event_id) : null,
    timestamp: toDate(norm?.timestamp),
    source,
    event_type: norm?.event_type ?? null,
    user_name: norm?.username ?? null,
    host_name: norm?.hostname ?? null,
    process_name: norm?.process_name ?? null,
    process_path: norm?.process_path ?? null,
    process_id: norm?.process_id ?? null,
    parent_process_id: norm?.parent_process_id ?? null,
    parent_process_name: norm?.parent_process_name ?? null,
    command_line: norm?.command_line ?? null,
    file_path: raw?.file_path ?? raw?.FilePath ?? null,
    file_hash_sha256: norm?.file_hash_sha256 ?? null,
    registry_key: norm?.registry_key ?? null,
    registry_value_name: norm?.registry_value_name ?? null,
    source_ip: norm?.source_ip ?? null,
    destination_ip: norm?.destination_ip ?? null,
    destination_port: norm?.destination_port ?? null,
    protocol: norm?.protocol ?? null,
    dns_query: norm?.dns_query ?? null,
    action: raw?.action ?? null,
    ingest_id: ingestId || mkIngestId(),
    metadata_json: {
      legacy_raw_event_id: norm?.raw_event_id ?? null,
      legacy_event_source: norm?.event_source ?? null,
      image_loaded_path: norm?.image_loaded_path ?? null,
    },
    raw_json: raw,
  };
}

/**
 * Normalize a legacy raw_event row (DB row from raw_events) into an XDR event.
 */
function fromLegacyRawEventRow(rawEventRow, { tenantId = null, ingestId = null } = {}) {
  const norm = EventNormalizationService.normalize(rawEventRow);
  return fromLegacyNormalized(norm, { tenantId, source: 'endpoint', ingestId });
}

module.exports = { fromLegacyNormalized, fromLegacyRawEventRow, mkIngestId };

