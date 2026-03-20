/**
 * Alert correlation - groups related alerts into incidents
 * Phase A: Same endpoint, within 1h window
 */
const db = require('../utils/db');
const IncidentService = require('../modules/incidents/incidentService');
const logger = require('../utils/logger');

const CORRELATION_WINDOW_HOURS = 1;

/**
 * Find uncorrelated alerts from same endpoint within time window,
 * create incident and link them
 */
async function correlateRecentAlerts() {
  // Get alerts from last 2h that aren't already linked to an incident
  const alerts = await db.query(
    `SELECT a.id, a.endpoint_id, a.title, a.severity, a.first_seen, a.status
     FROM alerts a
     LEFT JOIN incident_alert_links ial ON ial.alert_id = a.id
     WHERE ial.id IS NULL
       AND a.first_seen >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND a.status IN ('new', 'investigating')
     ORDER BY a.endpoint_id, a.first_seen ASC`,
    [CORRELATION_WINDOW_HOURS * 2]
  );

  if (!alerts || alerts.length < 2) return;

  // Group by endpoint
  const byEndpoint = new Map();
  for (const a of alerts) {
    const key = a.endpoint_id;
    if (!byEndpoint.has(key)) byEndpoint.set(key, []);
    byEndpoint.get(key).push(a);
  }

  for (const [endpointId, endpointAlerts] of byEndpoint) {
    if (endpointAlerts.length < 2) continue;

    // Sort by time, find clusters within 1h
    endpointAlerts.sort((a, b) => new Date(a.first_seen) - new Date(b.first_seen));
    const clusters = [];
    let current = [endpointAlerts[0]];

    for (let i = 1; i < endpointAlerts.length; i++) {
      const prev = new Date(current[current.length - 1].first_seen);
      const curr = new Date(endpointAlerts[i].first_seen);
      const diffHours = (curr - prev) / (1000 * 60 * 60);

      if (diffHours <= CORRELATION_WINDOW_HOURS) {
        current.push(endpointAlerts[i]);
      } else {
        if (current.length >= 2) clusters.push([...current]);
        current = [endpointAlerts[i]];
      }
    }
    if (current.length >= 2) clusters.push(current);

    for (const cluster of clusters) {
      try {
        const maxSeverity = cluster.reduce((m, a) => {
          const order = { critical: 4, high: 3, medium: 2, low: 1 };
          return order[a.severity] > order[m] ? a.severity : m;
        }, 'low');
        const titles = [...new Set(cluster.map((a) => a.title))];
        const inc = await IncidentService.create({
          title: `Correlated: ${titles.slice(0, 2).join(', ')}${titles.length > 2 ? ' +' + (titles.length - 2) : ''}`,
          description: `${cluster.length} related alerts on same endpoint within ${CORRELATION_WINDOW_HOURS}h`,
          severity: maxSeverity,
          status: 'open',
          correlation_type: 'endpoint_time_window',
          endpoint_id: endpointId,
        });
        for (const a of cluster) {
          await IncidentService.linkAlert(inc.id, a.id);
        }
        logger.info({ incidentId: inc.incident_id, alertCount: cluster.length, endpointId }, 'Incident created from correlation');
      } catch (err) {
        logger.warn({ err: err.message }, 'Correlation create failed');
      }
    }
  }
}

module.exports = { correlateRecentAlerts };
