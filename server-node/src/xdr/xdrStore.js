const db = require('../utils/db');
const { publishXdrEvent } = require('../realtime/realtimeServer');

async function insertXdrEvent(ev) {
  const ts = ev.timestamp instanceof Date ? ev.timestamp : new Date(ev.timestamp);
  const meta = ev.metadata_json != null ? JSON.stringify(ev.metadata_json) : null;
  const raw = ev.raw_json != null ? JSON.stringify(ev.raw_json) : null;

  const r = await db.execute(
    `INSERT INTO xdr_events (
      tenant_id, endpoint_id, event_id, timestamp, source, event_type,
      user_name, host_name,
      process_name, process_path, process_id, parent_process_id, parent_process_name, command_line,
      file_path, file_hash_sha256,
      registry_key, registry_value_name,
      source_ip, destination_ip, destination_port, protocol, dns_query,
      action, metadata_json, raw_json,
      ingest_id, severity, risk_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ev.tenant_id ?? null,
      ev.endpoint_id ?? null,
      ev.event_id ?? null,
      ts,
      ev.source,
      ev.event_type ?? null,
      ev.user_name ?? null,
      ev.host_name ?? null,
      ev.process_name ?? null,
      ev.process_path ?? null,
      ev.process_id ?? null,
      ev.parent_process_id ?? null,
      ev.parent_process_name ?? null,
      ev.command_line ?? null,
      ev.file_path ?? null,
      ev.file_hash_sha256 ?? null,
      ev.registry_key ?? null,
      ev.registry_value_name ?? null,
      ev.source_ip ?? null,
      ev.destination_ip ?? null,
      ev.destination_port ?? null,
      ev.protocol ?? null,
      ev.dns_query ?? null,
      ev.action ?? null,
      meta,
      raw,
      ev.ingest_id ?? null,
      ev.severity ?? null,
      ev.risk_score ?? null,
    ]
  );
  try {
    await publishXdrEvent({
      id: r.insertId,
      tenant_id: ev.tenant_id ?? null,
      endpoint_id: ev.endpoint_id ?? null,
      source: ev.source ?? null,
      event_type: ev.event_type ?? null,
      timestamp: ts.toISOString(),
      severity: ev.severity ?? null,
      risk_score: ev.risk_score ?? null,
    });
  } catch {
    // best-effort realtime signal; never fail ingest
  }
  return r.insertId;
}

module.exports = { insertXdrEvent };

