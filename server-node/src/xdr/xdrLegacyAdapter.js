/**
 * Adapter: xdr_events row -> "normalizedEvent" shape expected by DetectionEngineService.
 * We keep only fields the rule engine reads today.
 */
function xdrToLegacyNorm(xdr) {
  if (!xdr) return null;
  let raw = xdr.raw_json;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  return {
    raw_event_id: xdr.id, // use xdr_event_id as source id for alerts
    endpoint_id: xdr.endpoint_id,
    hostname: xdr.host_name,
    username: xdr.user_name,
    timestamp: xdr.timestamp,
    event_source: xdr.source,
    event_type: xdr.event_type,
    process_name: xdr.process_name,
    process_path: xdr.process_path,
    process_id: xdr.process_id,
    parent_process_name: xdr.parent_process_name,
    parent_process_id: xdr.parent_process_id,
    command_line: xdr.command_line,
    file_hash_sha256: xdr.file_hash_sha256,
    source_ip: xdr.source_ip,
    destination_ip: xdr.destination_ip,
    destination_port: xdr.destination_port,
    protocol: xdr.protocol,
    dns_query: xdr.dns_query,
    dns_query_type: raw?.dns_query_type ?? null,
    registry_key: xdr.registry_key,
    registry_value_name: xdr.registry_value_name,
    image_loaded_path: raw?.image_loaded_path ?? null,
    powershell_command: raw?.powershell_command ?? null,
    raw_event_json: raw || {},
  };
}

module.exports = { xdrToLegacyNorm };

