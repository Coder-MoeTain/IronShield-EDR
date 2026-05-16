/**
 * MySQL event store (default) — raw_events + normalized_events.
 */
const db = require('../utils/db');

async function insertRaw(event) {
  const r = await db.execute(
    `INSERT INTO raw_events (endpoint_id, event_type, payload_json, batch_id, received_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [
      event.endpoint_id,
      event.event_type || 'telemetry',
      JSON.stringify(event.payload || event),
      event.batch_id || null,
    ]
  );
  return { id: r.insertId, store: 'mysql' };
}

async function insertNormalized(norm) {
  const r = await db.execute(
    `INSERT INTO normalized_events (
       raw_event_id, endpoint_id, hostname, username, timestamp, event_source, event_type,
       process_name, process_path, process_id, parent_process_name, parent_process_id,
       command_line, file_hash_sha256, source_ip, destination_ip, destination_port,
       protocol, dns_query, dns_query_type, registry_key, registry_value_name,
       image_loaded_path, raw_event_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      norm.raw_event_id,
      norm.endpoint_id,
      norm.hostname,
      norm.username,
      norm.timestamp,
      norm.event_source,
      norm.event_type,
      norm.process_name,
      norm.process_path,
      norm.process_id,
      norm.parent_process_name,
      norm.parent_process_id,
      norm.command_line,
      norm.file_hash_sha256,
      norm.source_ip,
      norm.destination_ip,
      norm.destination_port,
      norm.protocol,
      norm.dns_query,
      norm.dns_query_type,
      norm.registry_key,
      norm.registry_value_name,
      norm.image_loaded_path,
      JSON.stringify(norm.raw_event_json || {}),
    ]
  );
  return { id: r.insertId, store: 'mysql' };
}

module.exports = { insertRaw, insertNormalized, name: 'mysql' };
