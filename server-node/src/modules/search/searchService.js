/**
 * Global search across alerts, endpoints, events, hashes, usernames, processes
 */
const db = require('../../utils/db');

async function globalSearch(query, limit = 50) {
  if (!query || String(query).trim().length < 2) {
    return { endpoints: [], alerts: [], events: [], hashes: [] };
  }

  const q = `%${String(query).trim()}%`;
  const results = { endpoints: [], alerts: [], events: [], hashes: [] };

  results.endpoints = await db.query(
    `SELECT id, hostname, ip_address, status, last_heartbeat_at FROM endpoints
     WHERE hostname LIKE ? OR ip_address LIKE ? OR logged_in_user LIKE ?
     LIMIT ?`,
    [q, q, q, limit]
  );

  results.alerts = await db.query(
    `SELECT a.id, a.title, a.severity, a.status, a.first_seen, e.hostname
     FROM alerts a JOIN endpoints e ON e.id = a.endpoint_id
     WHERE a.title LIKE ? OR a.description LIKE ?
     ORDER BY a.first_seen DESC LIMIT ?`,
    [q, q, limit]
  );

  results.events = await db.query(
    `SELECT ne.id, ne.event_type, ne.process_name, ne.username, ne.timestamp, e.hostname
     FROM normalized_events ne JOIN endpoints e ON e.id = ne.endpoint_id
     WHERE ne.process_name LIKE ? OR ne.username LIKE ? OR ne.command_line LIKE ?
     ORDER BY ne.timestamp DESC LIMIT ?`,
    [q, q, q, limit]
  );

  results.hashes = await db.query(
    `SELECT id, file_hash_sha256, process_name, endpoint_id, timestamp
     FROM normalized_events
     WHERE file_hash_sha256 LIKE ?
     LIMIT ?`,
    [q, limit]
  );

  return results;
}

module.exports = { globalSearch };
