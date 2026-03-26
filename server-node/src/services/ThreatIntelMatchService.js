/**
 * Match outbound connections against ThreatIntelFeedService and raise alerts.
 */
const ThreatIntelFeedService = require('./ThreatIntelFeedService');
const AlertService = require('./AlertService');
const config = require('../config');

function isNetworkNorm(norm) {
  const et = String(norm?.event_type || '').toLowerCase();
  return et === 'network_connection' || et.includes('network');
}

/**
 * @param {object} norm - normalized event
 * @param {number} normalizedEventId - normalized_events.id
 */
async function checkConnection(norm, normalizedEventId) {
  if (!config.threatIntel?.enabled) return;
  if (!norm?.endpoint_id || !norm?.destination_ip) return;
  if (!isNetworkNorm(norm)) return;

  const hit = ThreatIntelFeedService.lookup(norm.destination_ip);
  if (!hit) return;

  await AlertService.createThreatIntelAlert({
    endpoint_id: norm.endpoint_id,
    normalized_event_id: normalizedEventId,
    raw_event_id: norm.raw_event_id,
    remote_ip: norm.destination_ip,
    remote_port: norm.destination_port,
    protocol: norm.protocol,
    process_name: norm.process_name,
    feed_names: hit.feedNames,
    timestamp: norm.timestamp,
  });
}

module.exports = { checkConnection };
