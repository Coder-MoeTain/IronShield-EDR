/**
 * Falcon-style "analytics" facade — heuristic risk + summaries (not cloud ML).
 */
const db = require('../utils/db');
const MISSING_TABLE_ERRORS = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);

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

  const trend7d = await db.query(
    `SELECT DATE(a.first_seen) AS day, COUNT(*) AS c
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     ${base}
     AND a.first_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY DATE(a.first_seen)
     ORDER BY day ASC`,
    params
  );

  const byStatus = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(a.status), ''), 'open') AS status, COUNT(*) AS c
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     ${base}
     GROUP BY COALESCE(NULLIF(TRIM(a.status), ''), 'open')
     ORDER BY c DESC`,
    params
  );

  const topMitre = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(a.mitre_technique), ''), 'unmapped') AS technique, COUNT(*) AS c
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     ${base}
     GROUP BY COALESCE(NULLIF(TRIM(a.mitre_technique), ''), 'unmapped')
     ORDER BY c DESC
     LIMIT 10`,
    params
  );

  const totals = await db.queryOne(
    `SELECT
       COUNT(*) AS total_alerts,
       COUNT(DISTINCT a.endpoint_id) AS affected_hosts,
       ROUND(AVG(
         LEAST(100, GREATEST(0,
           (CASE a.severity WHEN 'critical' THEN 95 WHEN 'high' THEN 75 WHEN 'medium' THEN 50 WHEN 'low' THEN 25 ELSE 15 END)
           * COALESCE(a.confidence, 0.5)
         ))
       ), 1) AS avg_risk
     FROM alerts a
     JOIN endpoints e ON e.id = a.endpoint_id
     ${base}`,
    params
  );

  const withNarrative = (recent || []).map((r) => ({
    ...r,
    narrative: riskNarrative(r),
  }));

  return {
    kpis: {
      total_alerts: Number(totals?.total_alerts || 0),
      affected_hosts: Number(totals?.affected_hosts || 0),
      avg_risk: Number(totals?.avg_risk || 0),
      high_or_critical: Number(
        (bySev || []).reduce((acc, row) => {
          const sev = String(row?.severity || '').toLowerCase();
          if (sev === 'high' || sev === 'critical') return acc + Number(row?.c || 0);
          return acc;
        }, 0)
      ),
    },
    by_severity: bySev,
    by_status: byStatus,
    trend_7d: trend7d,
    top_mitre: topMitre,
    recent_detections: withNarrative,
    disclaimer:
      'Risk scores and narratives are heuristic (severity × confidence). Not CrowdStrike cloud ML.',
  };
}

async function detectionQualitySummary(tenantId) {
  try {
    const scopeJoin = tenantId != null
      ? 'JOIN alerts a ON a.id = dqe.alert_id JOIN endpoints e ON e.id = a.endpoint_id'
      : '';
    const where = tenantId != null ? 'WHERE e.tenant_id = ?' : '';
    const params = tenantId != null ? [tenantId] : [];

    const kpi = await db.queryOne(
      `SELECT
         COUNT(*) AS total_feedback,
         SUM(CASE WHEN analyst_disposition = 'true_positive' THEN 1 ELSE 0 END) AS true_positive,
         SUM(CASE WHEN analyst_disposition = 'false_positive' THEN 1 ELSE 0 END) AS false_positive,
         ROUND(AVG(COALESCE(analyst_confidence, 0.5)), 3) AS avg_analyst_confidence
       FROM detection_quality_events dqe
       ${scopeJoin}
       ${where}`,
      params
    );

    const byDisposition = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(dqe.analyst_disposition), ''), 'unknown') AS disposition, COUNT(*) AS c
       FROM detection_quality_events dqe
       ${scopeJoin}
       ${where}
       GROUP BY COALESCE(NULLIF(TRIM(dqe.analyst_disposition), ''), 'unknown')
       ORDER BY c DESC`,
      params
    );

    const noisyRules = await db.query(
      `SELECT a.rule_id, COALESCE(dr.name, CONCAT('rule_', a.rule_id)) AS rule_name,
              SUM(CASE WHEN dqe.analyst_disposition = 'false_positive' THEN 1 ELSE 0 END) AS fp_count,
              COUNT(*) AS total_feedback,
              ROUND(SUM(CASE WHEN dqe.analyst_disposition = 'false_positive' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 3) AS fp_rate
       FROM detection_quality_events dqe
       JOIN alerts a ON a.id = dqe.alert_id
       LEFT JOIN detection_rules dr ON dr.id = a.rule_id
       ${tenantId != null ? 'JOIN endpoints e ON e.id = a.endpoint_id' : ''}
       ${tenantId != null ? 'WHERE e.tenant_id = ?' : ''}
       GROUP BY a.rule_id, dr.name
       HAVING total_feedback >= 3
       ORDER BY fp_rate DESC, fp_count DESC
       LIMIT 10`,
      params
    );

    const highSignalRules = await db.query(
      `SELECT a.rule_id, COALESCE(dr.name, CONCAT('rule_', a.rule_id)) AS rule_name,
              SUM(CASE WHEN dqe.analyst_disposition = 'true_positive' THEN 1 ELSE 0 END) AS tp_count,
              COUNT(*) AS total_feedback,
              ROUND(SUM(CASE WHEN dqe.analyst_disposition = 'true_positive' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 3) AS tp_rate
       FROM detection_quality_events dqe
       JOIN alerts a ON a.id = dqe.alert_id
       LEFT JOIN detection_rules dr ON dr.id = a.rule_id
       ${tenantId != null ? 'JOIN endpoints e ON e.id = a.endpoint_id' : ''}
       ${tenantId != null ? 'WHERE e.tenant_id = ?' : ''}
       GROUP BY a.rule_id, dr.name
       HAVING total_feedback >= 3
       ORDER BY tp_rate DESC, tp_count DESC
       LIMIT 10`,
      params
    );

    return {
      kpis: {
        total_feedback: Number(kpi?.total_feedback || 0),
        true_positive: Number(kpi?.true_positive || 0),
        false_positive: Number(kpi?.false_positive || 0),
        avg_analyst_confidence: Number(kpi?.avg_analyst_confidence || 0),
      },
      by_disposition: byDisposition || [],
      noisy_rules: noisyRules || [],
      high_signal_rules: highSignalRules || [],
    };
  } catch (err) {
    if (MISSING_TABLE_ERRORS.has(err?.code)) {
      return {
        kpis: { total_feedback: 0, true_positive: 0, false_positive: 0, avg_analyst_confidence: 0 },
        by_disposition: [],
        noisy_rules: [],
        high_signal_rules: [],
      };
    }
    throw err;
  }
}

module.exports = { detectionSummary, detectionQualitySummary, riskNarrative };
