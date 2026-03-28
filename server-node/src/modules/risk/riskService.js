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

function tamperBonusFromJson(raw) {
  if (raw == null) return { bonus: 0, label: null };
  let o = raw;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return { bonus: 0, label: null };
    }
  }
  if (typeof o !== 'object' || o === null) return { bonus: 0, label: null };
  const r = String(o.tamper_risk || '').toLowerCase();
  if (r === 'high') return { bonus: 18, label: 'high' };
  if (r === 'medium') return { bonus: 8, label: 'medium' };
  if (r === 'low') return { bonus: 0, label: 'low' };
  return { bonus: 0, label: null };
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

  let tamperBonus = 0;
  try {
    const row = await db.queryOne('SELECT tamper_signals_json FROM endpoints WHERE id = ?', [endpointId]);
    const { bonus, label } = tamperBonusFromJson(row?.tamper_signals_json);
    tamperBonus = bonus;
    if (label) factors.tamper_risk = label;
  } catch (_) {
    /* column missing or parse error */
  }
  score = Math.min(100, score + tamperBonus);
  if (tamperBonus) factors.tamper_bonus_points = tamperBonus;

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

  try {
    await db.execute('UPDATE endpoints SET risk_score = ? WHERE id = ?', [score, endpointId]);
  } catch (err) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }

  return { risk_score: score, factors };
}

module.exports = { getEndpointRisk, getEndpointRiskList, calculateEndpointRisk };
