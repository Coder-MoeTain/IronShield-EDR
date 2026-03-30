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
| **IOCs** | `FalconTableShell` (toolbar: search, type filter, KPI metrics); `FalconEmptyState` for empty filtered watchlist + for matches; **severity cells use `falconSeverityClass`** |

## Phase 2 verification

- `npm test` — includes `FalconTableShell.test.jsx` + existing `falconUi` / `FalconPagination` tests.
- `npm run build` — production bundle must succeed.

## Follow-up (optional)

- ~~Return `{ investigations|incidents, total }` from list APIs~~ — **done**: `GET /api/admin/investigations` returns `{ investigations, total }`; `GET /api/admin/incidents` returns `{ incidents, total }`. Dashboard passes `total` into `FalconPagination`.
- ~~Apply `FalconTableShell` to Detections / Events pages~~ — done (see [Phase 2](crowdstrike-ui-phase2.md)).

**IOC watchlist** — `IOCs.jsx` uses `FalconTableShell` (toolbar: search + metrics) and `FalconEmptyState` when the filtered watchlist is empty.

## Notes

Same disclaimer as Phase 1–2: visual parity for SOC UX only.

**Phase 4:** [Sensor telemetry & containment strip](crowdstrike-ui-phase4.md) on host detail and host list.
