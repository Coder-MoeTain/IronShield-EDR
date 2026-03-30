# CrowdStrike Falcon–class UI — Phase 2

Phase 2 adds **shared list UX** (empty states + pagination), **accessibility** (skip link, visible focus), **tests** for helpers/components, and documentation for extending other routes.

## Components

### `FalconEmptyState` (`dashboard/src/components/FalconEmptyState.jsx`)

- Props: `title`, optional `description`, optional `icon` (e.g. emoji), optional `children` (actions).
- Uses `.falcon-empty` styles in `index.css`.

### `FalconPagination` (`dashboard/src/components/FalconPagination.jsx`)

- Offset/limit model aligned with admin APIs (`offset`, `limit`, optional `total`).
- Props: `pageItemCount` (rows on current page), `onPrev`, `onNext`, optional `onLimitChange` + `pageSizeOptions`.
- Range label via `falconPaginationRangeLabel` / next-page logic via `falconCanGoNext` in `utils/falconUi.js`.

### Where it’s wired

**List UX (empty state + pagination)**

- **Detections** (`Alerts.jsx`) — `FalconTableShell` (toolbar: stats, filters, saved views, bulk actions, column toggles; footer: pagination) + empty state + rows-per-page (25 / 50 / 100).
- **Events** (`Events.jsx`) — same shell pattern + pagination.
- **Hosts** (`Endpoints.jsx`) — empty state when no agents.
- **Raw / normalized events, investigations, incidents** — see [Phase 3](crowdstrike-ui-phase3.md) (`FalconTableShell` + pagination).
- **IOCs, Sensor health** — empty states where applicable.
- **Audit & activity** (`AuditLogs.jsx`) — `FalconTableShell`, action filter, **server pagination** (`GET /api/admin/audit-logs` returns `{ logs, total }`).
- **Custom IOA rules** (`DetectionRules.jsx` rules tab) — `FalconTableShell` + filter toolbar + empty state.
- **Host groups** (`HostGroups.jsx`) — `FalconEmptyState` when no groups.

Import the same components and pass existing `offset` / `limit` / `total` (or inferred next-page) state.

## Accessibility

- **Skip link** (`Layout.jsx`): “Skip to main content” → `#main-content` on `<main>`. Styled with `.falcon-skip-link` (visible on `:focus`).
- **Focus rings**: `.falcon-btn`, pagination buttons, and filter controls use `:focus-visible` with cyan outline (`index.css`).

## Tests

From `server-node/dashboard`:

```bash
npm install
npm test
```

- `src/utils/falconUi.test.js` — severity + pagination helpers.
- `src/utils/routeMeta.test.js` — breadcrumbs / document title.
- `src/components/FalconPagination.test.jsx` — render + basic a11y behavior.
- `src/components/FalconEmptyState.test.jsx` — title, description, optional actions.
- `src/components/FalconTableShell.test.jsx` — layout shell.

Uses **Vitest** + **Testing Library** + **jsdom** (see `package.json`).

## Completed in Phase 3

See **[crowdstrike-ui-phase3.md](./crowdstrike-ui-phase3.md)** — `FalconTableShell`, Raw/Normalized events, Investigations, Incidents, IOCs, IOC severity fix.

## Notes

Same disclaimer as Phase 1: visual parity for SOC UX only; not affiliated with CrowdStrike.
