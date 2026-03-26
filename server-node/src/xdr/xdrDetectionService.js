const db = require('../utils/db');
const DetectionEngineService = require('../services/DetectionEngineService');
const AlertService = require('../services/AlertService');
const { getXdrEventById } = require('./xdrQuery');
const { xdrToLegacyNorm } = require('./xdrLegacyAdapter');

function toRisk(severity, confidence) {
  const sev = String(severity || '').toLowerCase();
  const base = sev === 'critical' ? 95 : sev === 'high' ? 75 : sev === 'medium' ? 50 : sev === 'low' ? 25 : 15;
  const c = confidence == null ? 0.75 : Number(confidence);
  return Math.max(0, Math.min(100, Math.round(base * c)));
}

async function recordDetection({ tenantId, endpointId, xdrEventId, detector, ruleId, prediction, confidence, severity, title, details }) {
  const risk = toRisk(severity, confidence);
  const r = await db.execute(
    `INSERT INTO xdr_detections (
      tenant_id, endpoint_id, xdr_event_id, detector, rule_id, prediction, confidence, risk_score, severity, title, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId ?? null,
      endpointId ?? null,
      xdrEventId,
      detector,
      ruleId ?? null,
      prediction,
      confidence ?? null,
      risk,
      severity ?? null,
      title ?? null,
      details ? JSON.stringify(details) : null,
    ]
  );
  return { id: r.insertId, risk_score: risk };
}

async function detectFromXdrEventId(xdrEventId) {
  const xdr = await getXdrEventById(xdrEventId);
  if (!xdr) return { detections: 0 };
  const norm = xdrToLegacyNorm(xdr);
  if (!norm) return { detections: 0 };

  const alerts = await DetectionEngineService.evaluateAndAlert(norm);
  if (!alerts.length) return { detections: 0 };

  // Persist detections + create alerts for UI continuity.
  for (const a of alerts) {
    await recordDetection({
      tenantId: xdr.tenant_id ?? null,
      endpointId: xdr.endpoint_id ?? null,
      xdrEventId,
      detector: 'rules',
      ruleId: a.rule_id ?? null,
      prediction: 'malicious',
      confidence: a.confidence ?? 0.85,
      severity: a.severity ?? 'medium',
      title: a.title ?? 'Detection',
      details: { description: a.description, mitre_tactic: a.mitre_tactic, mitre_technique: a.mitre_technique },
    });
  }

  // Alerts table expects endpoint_id and timestamps; we use xdr_event_id as source_event_ids.
  await AlertService.createFromDetection(
    alerts.map((a) => ({
      ...a,
      source_event_ids: JSON.stringify([xdrEventId]),
      first_seen: norm.timestamp,
      last_seen: norm.timestamp,
    }))
  );

  return { detections: alerts.length };
}

module.exports = { detectFromXdrEventId, recordDetection };

