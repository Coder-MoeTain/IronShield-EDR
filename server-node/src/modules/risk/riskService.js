/**
 * Risk scoring service - endpoint and entity risk
 */
const db = require('../../utils/db');

function isMissingRiskTableError(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' || String(err?.message || '').includes('endpoint_risk_scores');
}

async function getEndpointRisk(endpointId) {
  try {
    const rows = await db.query(
      `SELECT risk_score, score_factors, calculated_at
       FROM endpoint_risk_scores
       WHERE endpoint_id = ?
       ORDER BY calculated_at DESC LIMIT 1`,
      [endpointId]
    );
    return rows?.[0] || { risk_score: 0 };
  } catch (err) {
    if (isMissingRiskTableError(err)) {
      return { risk_score: 0 };
    }
    throw err;
  }
}

async function getEndpointRiskList(limit = 20) {
  try {
    return await db.query(
      `SELECT ers.endpoint_id, e.hostname, ers.risk_score, ers.calculated_at
       FROM endpoint_risk_scores ers
       JOIN endpoints e ON e.id = ers.endpoint_id
       ORDER BY ers.risk_score DESC, ers.calculated_at DESC
       LIMIT ?`,
      [limit]
    );
  } catch (err) {
    if (isMissingRiskTableError(err)) {
      return [];
    }
    throw err;
  }
}

async function calculateEndpointRisk(endpointId) {
  const alerts = await db.query(
    `SELECT severity, COUNT(*) as c FROM alerts
     WHERE endpoint_id = ? AND status IN ('new', 'investigating')
     GROUP BY severity`,
    [endpointId]
  );
  let score = 0;
  const factors = {};
  for (const r of alerts) {
    const pts = r.severity === 'critical' ? 40 : r.severity === 'high' ? 20 : r.severity === 'medium' ? 10 : 5;
    score += r.c * pts;
    factors[`alerts_${r.severity}`] = r.c;
  }
  score = Math.min(score, 100);
  try {
    await db.execute(
      'INSERT INTO endpoint_risk_scores (endpoint_id, risk_score, score_factors) VALUES (?, ?, ?)',
      [endpointId, score, JSON.stringify(factors)]
    );
  } catch (err) {
    if (!isMissingRiskTableError(err)) {
      throw err;
    }
  }
  return { risk_score: score, factors };
}

module.exports = { getEndpointRisk, getEndpointRiskList, calculateEndpointRisk };
