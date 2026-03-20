/**
 * Process all unprocessed raw_events into normalized_events.
 * Run this to backfill normalized_events so Process Monitor shows data.
 */
const db = require('../src/utils/db');
const EventNormalizationService = require('../src/services/EventNormalizationService');
const DetectionEngineService = require('../src/services/DetectionEngineService');
const AlertService = require('../src/services/AlertService');

async function processBatch(limit = 500) {
  const rows = await db.query(
    'SELECT * FROM raw_events WHERE processed = 0 ORDER BY id ASC LIMIT ?',
    [limit]
  );

  let processed = 0;
  for (const rawEvent of rows) {
    try {
      const norm = EventNormalizationService.normalize(rawEvent);
      const vals = (v) => (v === undefined ? null : v);
      await db.execute(
        `INSERT INTO normalized_events (raw_event_id, endpoint_id, hostname, username, timestamp, event_source, event_type, process_name, process_path, process_id, parent_process_name, parent_process_id, command_line, raw_event_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vals(rawEvent.id),
          vals(norm.endpoint_id),
          vals(norm.hostname),
          vals(norm.username),
          vals(norm.timestamp),
          vals(norm.event_source),
          vals(norm.event_type),
          vals(norm.process_name),
          vals(norm.process_path),
          vals(norm.process_id),
          vals(norm.parent_process_name),
          vals(norm.parent_process_id),
          vals(norm.command_line),
          JSON.stringify(norm.raw_event_json || {}),
        ]
      );
      const alerts = await DetectionEngineService.evaluateAndAlert(norm);
      if (alerts.length > 0) {
        await AlertService.createFromDetection(alerts);
      }
      await db.execute('UPDATE raw_events SET processed = 1 WHERE id = ?', [rawEvent.id]);
      processed++;
    } catch (err) {
      console.error('Error processing event', rawEvent.id, err.message);
    }
  }
  return processed;
}

async function main() {
  let total = 0;
  let batch;
  do {
    batch = await processBatch(500);
    total += batch;
    if (batch > 0) {
      console.log('Processed', batch, 'events. Total:', total);
    }
  } while (batch > 0);

  console.log('Done. Normalized', total, 'events.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
