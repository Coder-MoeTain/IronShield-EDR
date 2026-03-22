/** CrowdStrike Falcon–style severity pill classes (see index.css .falcon-sev-*) */
export function falconSeverityClass(severity) {
  const s = (severity || '').toLowerCase();
  if (s === 'critical') return 'falcon-sev falcon-sev-critical';
  if (s === 'high') return 'falcon-sev falcon-sev-high';
  if (s === 'medium') return 'falcon-sev falcon-sev-medium';
  if (s === 'low') return 'falcon-sev falcon-sev-low';
  return 'falcon-sev falcon-sev-info';
}

/**
 * Human-readable range for offset/limit tables (Phase 2 pagination).
 * @param {number} offset
 * @param {number} limit
 * @param {number} pageItemCount rows returned for this page
 * @param {number|null|undefined} total optional total matching query
 */
export function falconPaginationRangeLabel(offset, limit, pageItemCount, total) {
  const o = Math.max(0, Number(offset) || 0);
  const l = Math.max(1, Number(limit) || 50);
  const n = Math.max(0, Number(pageItemCount) || 0);
  if (n === 0) {
    return total != null && total >= 0 ? `0 of ${total}` : 'No results';
  }
  const start = o + 1;
  const end = o + Math.min(n, l);
  if (total != null && total >= 0) {
    return `${start}–${end} of ${total}`;
  }
  return `${start}–${end}`;
}

/** Whether “Next” should be disabled when total is unknown (infer from page fill). */
export function falconCanGoNext(offset, limit, pageItemCount, total) {
  const o = Math.max(0, Number(offset) || 0);
  const l = Math.max(1, Number(limit) || 50);
  const n = Math.max(0, Number(pageItemCount) || 0);
  if (total != null && total >= 0) {
    return o + l < total;
  }
  return n >= l;
}
