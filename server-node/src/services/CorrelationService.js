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

/**
 * Phase 5: correlate XDR detections into incidents (endpoint + time window).
 * Minimal baseline: same endpoint, >=2 xdr_detections within 60 minutes.
 */
async function correlateRecentXdrDetections() {
  try {
    const rows = await db.query(
      `SELECT d.id, d.tenant_id, d.endpoint_id, d.xdr_event_id, d.severity, d.title, d.created_at
       FROM xdr_detections d
       LEFT JOIN incident_xdr_event_links ixl ON ixl.xdr_event_id = d.xdr_event_id
       WHERE ixl.id IS NULL
         AND d.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY d.endpoint_id, d.created_at ASC`,
      [CORRELATION_WINDOW_HOURS * 2]
    );
    if (!rows || rows.length < 2) return;

    const byEndpoint = new Map();
    for (const r of rows) {
      const k = r.endpoint_id || 0;
      if (!byEndpoint.has(k)) byEndpoint.set(k, []);
      byEndpoint.get(k).push(r);
    }

    for (const [endpointId, dets] of byEndpoint) {
      if (!endpointId || dets.length < 2) continue;
      dets.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const clusters = [];
      let current = [dets[0]];
      for (let i = 1; i < dets.length; i++) {
        const prev = new Date(current[current.length - 1].created_at);
        const curr = new Date(dets[i].created_at);
        const diffHours = (curr - prev) / (1000 * 60 * 60);
        if (diffHours <= CORRELATION_WINDOW_HOURS) current.push(dets[i]);
        else {
          if (current.length >= 2) clusters.push([...current]);
          current = [dets[i]];
        }
      }
      if (current.length >= 2) clusters.push(current);

      for (const cluster of clusters) {
        try {
          const maxSeverity = cluster.reduce((m, a) => {
            const order = { critical: 4, high: 3, medium: 2, low: 1 };
            return order[a.severity] > order[m] ? a.severity : m;
          }, 'low');
          const titles = [...new Set(cluster.map((a) => a.title).filter(Boolean))];
          const inc = await IncidentService.create({
            title: `XDR: ${titles.slice(0, 2).join(', ')}${titles.length > 2 ? ' +' + (titles.length - 2) : ''}`,
            description: `${cluster.length} related XDR detections on same endpoint within ${CORRELATION_WINDOW_HOURS}h`,
            severity: maxSeverity,
            status: 'open',
            correlation_type: 'xdr_endpoint_time_window',
            endpoint_id: endpointId,
          });
          for (const d of cluster) {
            await IncidentService.linkXdrEvent(inc.id, d.xdr_event_id);
          }
          logger.info({ incidentId: inc.incident_id, endpointId, detectionCount: cluster.length }, 'XDR incident created');
        } catch (err) {
          logger.warn({ err: err.message }, 'XDR correlation create failed');
        }
      }
    }
  } catch (e) {
    // missing table or early phase; ignore
  }
}

module.exports = { correlateRecentAlerts, correlateRecentXdrDetections };
