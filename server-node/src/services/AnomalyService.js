/**
 * Phase C: lightweight behavioral signal — rare process paths per endpoint (baseline-free).
 */
const db = require('../utils/db');

async function getRareProcessPaths(query = {}) {
  const endpointId = query.endpointId ? parseInt(query.endpointId, 10) : null;
  const days = Math.min(parseInt(query.days, 10) || 7, 90);
  const limit = Math.min(parseInt(query.limit, 10) || 40, 200);
  const maxCount = Math.min(parseInt(query.maxCount, 10) || 2, 10);

  if (!endpointId) {
    return { endpoint_id: null, rare_paths: [], hint: 'Pass endpointId to analyze a single host.' };
  }

  const rows = await db.query(
    `SELECT process_path, COUNT(*) AS cnt
     FROM normalized_events
     WHERE endpoint_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND process_path IS NOT NULL AND LENGTH(TRIM(process_path)) > 3
     GROUP BY process_path
     HAVING cnt <= ?
     ORDER BY cnt ASC, process_path ASC
     LIMIT ?`,
    [endpointId, days, maxCount, limit]
  );

  return { endpoint_id: endpointId, window_days: days, max_occurrences: maxCount, rare_paths: rows || [] };
}

module.exports = { getRareProcessPaths };
