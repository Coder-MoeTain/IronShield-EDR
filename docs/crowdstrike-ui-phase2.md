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

### Where it’s wired (initial pass)

- **Detections** (`Alerts.jsx`) — empty state + pagination + rows-per-page (25 / 50 / 100).
- **Events** (`Events.jsx`) — same.
- **Hosts** (`Endpoints.jsx`) — empty state when no agents.

Other table pages can import the same components and pass their existing `offset` / `limit` / `total` state.

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
- `src/components/FalconPagination.test.jsx` — render + basic a11y behavior.

Uses **Vitest** + **Testing Library** + **jsdom** (see `package.json`).

## Completed in Phase 3

See **[crowdstrike-ui-phase3.md](./crowdstrike-ui-phase3.md)** — `FalconTableShell`, Raw/Normalized events, Investigations, Incidents, IOCs, IOC severity fix.

## Notes

Same disclaimer as Phase 1: visual parity for SOC UX only; not affiliated with CrowdStrike.
