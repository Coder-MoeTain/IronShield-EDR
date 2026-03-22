# CrowdStrike Falcon–class UI — Phase 3

Phase 3 rolls **Phase 2 patterns** across more routes, adds a **`FalconTableShell`** layout helper, and fixes a **severity display bug** on the IOC page.

## New component

### `FalconTableShell` (`dashboard/src/components/FalconTableShell.jsx`)

Optional slots:

- **`toolbar`** — filter row (e.g. `falcon-filter-bar`)
- **`children`** — main table / list region
- **`footer`** — typically `FalconPagination`

Styles: `.falcon-table-shell` and children in `index.css`.

## Routes updated

| Page | Changes |
|------|---------|
| **Raw events** | `FalconTableShell`, `FalconEmptyState`, `FalconPagination` (+ rows/page); filter submit preserves `limit` |
| **Normalized events** | Same pattern |
| **Investigations** | Shell + empty state + pagination (no total from API — next page inferred from row count) |
| **Incidents** | Shell + empty state + pagination |
| **IOCs** | `FalconEmptyState` for watchlist + matches; **severity cells use `falconSeverityClass`** (was broken: `severityClass` undefined) |

## Phase 2 verification

- `npm test` — includes `FalconTableShell.test.jsx` + existing `falconUi` / `FalconPagination` tests.
- `npm run build` — production bundle must succeed.

## Follow-up (optional)

- Return `{ rows, total }` from `/api/admin/investigations` and `/api/admin/incidents` for exact pagination counts.
- Apply `FalconTableShell` to Detections / Events pages for structural consistency (already have pagination).

## Notes

Same disclaimer as Phase 1–2: visual parity for SOC UX only.

**Phase 4:** [Sensor telemetry & containment strip](crowdstrike-ui-phase4.md) on host detail and host list.
