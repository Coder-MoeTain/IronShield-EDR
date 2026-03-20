/**
 * Event ingestion service - stores raw events, normalizes, and runs detection
 * Supports sync (default) or BullMQ/Redis queue-based processing
 */
const db = require('../utils/db');
const logger = require('../utils/logger');
const EventNormalizationService = require('./EventNormalizationService');
const DetectionEngineService = require('./DetectionEngineService');
const AlertService = require('./AlertService');
const IocMatchingService = require('./IocMatchingService');
const QueueService = require('./QueueService');
const NetworkService = require('./NetworkService');

/**
 * Process unprocessed raw events for an endpoint (normalize, IOC match, detect, alert)
 * Used by worker or inline when queue is disabled
 */
async function processUnprocessed(endpointId, limit = 100) {
  const inserted = await db.query(
    `SELECT * FROM raw_events WHERE endpoint_id = ? AND processed = 0 ORDER BY id ASC LIMIT ?`,
    [endpointId, limit]
  );
  const toNull = (v) => (v === undefined ? null : v);
  let processed = 0;
  for (const rawEvent of inserted) {
    const norm = EventNormalizationService.normalize(rawEvent);
    const insertResult = await db.execute(
      `INSERT INTO normalized_events (raw_event_id, endpoint_id, hostname, username, timestamp, event_source, event_type, process_name, process_path, process_id, parent_process_name, parent_process_id, command_line, file_hash_sha256, source_ip, destination_ip, destination_port, protocol, raw_event_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toNull(rawEvent.id),
        toNull(norm.endpoint_id),
        toNull(norm.hostname),
        toNull(norm.username),
        toNull(norm.timestamp),
        toNull(norm.event_source),
        toNull(norm.event_type),
        toNull(norm.process_name),
        toNull(norm.process_path),
        toNull(norm.process_id),
        toNull(norm.parent_process_name),
        toNull(norm.parent_process_id),
        toNull(norm.command_line),
        toNull(norm.file_hash_sha256),
        toNull(norm.source_ip),
        toNull(norm.destination_ip),
        toNull(norm.destination_port),
        toNull(norm.protocol),
        JSON.stringify(norm.raw_event_json || {}),
      ]
    );
    const normId = insertResult?.insertId;
    if (normId) {
      try {
        await IocMatchingService.checkAndRecordMatches(norm, normId);
      } catch (e) {
        logger.warn({ err: e.message }, 'IOC matching error');
      }
      if (norm.destination_ip && (norm.event_type === 'network_connection' || norm.event_type?.includes('network'))) {
        try {
          const raw = norm.raw_event_json || {};
          await NetworkService.upsertConnection(norm.endpoint_id, {
            local_address: norm.source_ip || raw.local_address,
            local_port: raw.local_port,
            remote_address: norm.destination_ip,
            remote_port: norm.destination_port,
            protocol: norm.protocol || 'TCP',
            state: raw.state,
            process_id: norm.process_id,
            process_name: norm.process_name,
            process_path: norm.process_path,
          });
        } catch (e) {
          logger.warn({ err: e.message }, 'Network connection upsert error');
        }
      }
    }
    const alerts = await DetectionEngineService.evaluateAndAlert(norm);
    if (alerts.length > 0) {
      await AlertService.createFromDetection(alerts);
    }
    await db.execute('UPDATE raw_events SET processed = 1 WHERE id = ?', [rawEvent.id]);
    processed++;
  }
  return processed;
}

/**
 * Ingest batch of events from agent
 * Inserts raw events, then queues processing job (if Redis) or processes inline
 */
async function ingestBatch(endpointId, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { inserted: 0 };
  }

  const values = [];
  const placeholders = [];

  for (const evt of events.slice(0, 500)) {
    const eventId = evt.event_id ? String(evt.event_id).substring(0, 128) : null;
    const hostname = evt.hostname ? String(evt.hostname).substring(0, 255) : null;
    const eventSource = evt.event_source ? String(evt.event_source).substring(0, 64) : null;
    const eventType = evt.event_type ? String(evt.event_type).substring(0, 64) : null;
    const timestamp = evt.timestamp ? new Date(evt.timestamp) : new Date();
    const rawJson = JSON.stringify(evt);

    values.push(endpointId, eventId, hostname, eventSource, eventType, timestamp, rawJson);
    placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
  }

  const sql = `INSERT INTO raw_events (endpoint_id, event_id, hostname, event_source, event_type, timestamp, raw_event_json)
               VALUES ${placeholders.join(', ')}`;

  const result = await db.execute(sql, values);
  logger.info({ endpointId, count: result.affectedRows }, 'Events ingested');

  if (QueueService.isEnabled()) {
    await QueueService.addProcessJob(endpointId, Math.min(result.affectedRows, 100));
  } else {
    try {
      await processUnprocessed(endpointId, Math.min(result.affectedRows, 100));
    } catch (err) {
      logger.warn({ err: err.message }, 'Detection/normalization error');
    }
  }

  return { inserted: result.affectedRows };
}

module.exports = { ingestBatch, processUnprocessed };
