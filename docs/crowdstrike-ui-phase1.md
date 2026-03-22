# CrowdStrike Falcon–class UI — Phase 1

Phase 1 aligns the IronShield dashboard with a **CrowdStrike Falcon / EDR–style** console: dark workspace, red brand rail, dense tables, and consistent page chrome.

## What was implemented

### Design tokens (`dashboard/src/index.css`)

- **Dark theme** uses GitHub-adjacent neutrals (`#0d1117`, `#161b22`, `#21262d`) similar to modern security consoles, with **Falcon-style severity** colors (`--sev-critical` … `--sev-info`).
- **Global utilities**: `.falcon-page`, `.falcon-btn` / `.falcon-btn-ghost` / `.falcon-btn-primary`, `.falcon-filter-bar`, `.falcon-sev-*` severity pills.
- **Page shell**: `.ui-page-header-row`, `.ui-page-actions` for title + toolbar rows.

### Layout

- **Sidebar** widened to **256px**, rail background `#010409` (CrowdStrike-style dark strip).

### `PageShell` component

`dashboard/src/components/PageShell.jsx` — wraps content with:

- `kicker` (uppercase red label)
- `title`, `description`
- optional `actions` (refresh, links)
- `loading` / `loadingLabel` for full-page spinner

### Helper

- `dashboard/src/utils/falconUi.js` — `falconSeverityClass()` for detection severity chips.

### Pages using `PageShell` (full pass)

All **authenticated** dashboard routes use `PageShell` (or embed the same content without chrome when `embedded={true}`):

- **Overview**: `Dashboard.jsx`
- **Detections / events**: `Alerts.jsx`, `Events.jsx`, `RawEvents.jsx`, `NormalizedEvents.jsx`, `EventDetail.jsx`, `NormalizedEventDetail.jsx`
- **Hosts**: `Endpoints.jsx`, `EndpointDetail.jsx`, `SensorHealth.jsx`, `HostGroups.jsx`
- **Configuration**: `DetectionRules.jsx`, `Policies.jsx`, `AuditLogs.jsx`, `Triage.jsx`
- **Respond / explore**: `Investigations.jsx`, `InvestigationDetail.jsx`, `Incidents.jsx`, `IncidentDetail.jsx`, `AlertDetail.jsx`, `IOCs.jsx`, `Risk.jsx`, `Hunting.jsx`, `ProcessMonitor.jsx`, `Network.jsx`, `ProcessTree.jsx`
- **Enterprise / MSSP**: `MsspConsole.jsx`, `TenantManagement.jsx`, `EnterpriseSettings.jsx`
- **Antivirus**: `AvOverview.jsx`, `AvDetections.jsx`, `AvDetectionDetail.jsx`, `AvQuarantine.jsx`, `AvScanTasks.jsx`, `AvPolicies.jsx`, `AvSignatures.jsx`, `AvMalwareAlerts.jsx`, `AvMalwareAlertDetail.jsx`, `AvFileReputation.jsx`
- **Automation**: `Playbooks.jsx` (standalone route uses `PageShell`; `embedded` hides chrome inside Triage)
- **Suppressions**: `Suppressions.jsx` (same pattern as Playbooks)

**Intentionally unchanged**: `Login.jsx` (full-page auth layout).

## Phase 2

See **[crowdstrike-ui-phase2.md](./crowdstrike-ui-phase2.md)** — shared `FalconEmptyState` / `FalconPagination`, skip link + focus styles, Vitest coverage.

## Phase 3

See **[crowdstrike-ui-phase3.md](./crowdstrike-ui-phase3.md)** — `FalconTableShell`, broader rollout + IOC severity fix.

## Notes

IronShield is **not** affiliated with CrowdStrike; this is a **visual parity** goal for lab/SOC UX only.
