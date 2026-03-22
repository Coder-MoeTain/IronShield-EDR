/**
 * Falcon-style "analytics" facade — heuristic risk + summaries (not cloud ML).
 */
const db = require('../utils/db');

function riskNarrative(alert) {
  const sev = (alert.severity || '').toLowerCase();
  const parts = [];
  if (sev === 'critical' || sev === 'high') parts.push('Elevated severity warrants rapid triage.');
  if (alert.mitre_technique) parts.push(`MITRE mapping: ${alert.mitre_technique}.`);
  if (alert.confidence != null && Number(alert.confidence) < 0.6) parts.push('Confidence is moderate — validate with host context.');
  return parts.join(' ') || 'Review host timeline and related detections.';
}

async function detectionSummary(tenantId) {
  const base = tenantId != null ? 'WHERE e.tenant_id = ?' : '';
  const params = tenantId != null ? [tenantId] : [];

  const bySev = await db.query(
    `SELECT a.severity, COUNT(*) AS c FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id ${base}
     GROUP BY a.severity`,
    params
  );

  const recent = await db.query(
    `SELECT a.id, a.title, a.severity, a.confidence, a.mitre_technique, a.first_seen, e.hostname,
      ROUND(LEAST(100, GREATEST(0,
        (CASE a.severity WHEN 'critical' THEN 95 WHEN 'high' THEN 75 WHEN 'medium' THEN 50 WHEN 'low' THEN 25 ELSE 15 END)
        * COALESCE(a.confidence, 0.5)
      ))) AS risk_score
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     ${base}
     ORDER BY a.first_seen DESC
     LIMIT 15`,
    params
  );

  const withNarrative = (recent || []).map((r) => ({
    ...r,
    narrative: riskNarrative(r),
  }));

  return {
    by_severity: bySev,
    recent_detections: withNarrative,
    disclaimer:
      'Risk scores and narratives are heuristic (severity × confidence). Not CrowdStrike cloud ML.',
  };
}

module.exports = { detectionSummary, riskNarrative };
