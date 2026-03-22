import React from 'react';
import { falconPaginationRangeLabel, falconCanGoNext } from '../utils/falconUi';

/**
 * Falcon-style prev/next + optional page size (Phase 2).
 * Pass `total` when the API returns it for accurate “of N” and next-page disable.
 */
export default function FalconPagination({
  offset = 0,
  limit = 50,
  total,
  pageItemCount = 0,
  onPrev,
  onNext,
  onLimitChange,
  pageSizeOptions = [25, 50, 100],
  className = '',
  labels = { prev: '← Previous', next: 'Next →' },
}) {
  const range = falconPaginationRangeLabel(offset, limit, pageItemCount, total);
  const canNext = falconCanGoNext(offset, limit, pageItemCount, total);
  const canPrev = offset > 0;

  return (
    <nav
      className={`falcon-pagination ${className}`.trim()}
      aria-label="Pagination"
    >
      <div className="falcon-pagination-row">
        <button
          type="button"
          className="falcon-btn falcon-btn-ghost falcon-pagination-btn"
          onClick={onPrev}
          disabled={!canPrev}
        >
          {labels.prev}
        </button>
        <span className="falcon-pagination-range mono">{range}</span>
        <button
          type="button"
          className="falcon-btn falcon-btn-ghost falcon-pagination-btn"
          onClick={onNext}
          disabled={!canNext}
        >
          {labels.next}
        </button>
      </div>
      {onLimitChange && pageSizeOptions?.length > 0 && (
        <label className="falcon-pagination-size">
          <span className="falcon-pagination-size-label">Rows per page</span>
          <select
            value={String(limit)}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );
}
