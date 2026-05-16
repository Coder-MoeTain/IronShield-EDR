# Legacy page wrappers

Implementation lives under `src/features/<module>/tabs/*Tab.jsx`.

`src/pages/*.jsx` (except `Login.jsx`, `NotFound.jsx`, and detail routes still routed from `App.jsx`) are thin re-exports for backward compatibility.

## Mapping (old page → feature tab)

| Legacy page | Feature module | Tab file |
|-------------|----------------|----------|
| Dashboard | overview | DashboardTab |
| Alerts | detections | AlertsTab |
| Endpoints | endpoints | EndpointsTab |
| Incidents | investigation | IncidentsTab |
| Hunting | hunting | HuntingTab |
| AvOverview | protection | AvOverviewTab |
| EnterpriseSettings | admin | EnterpriseSettingsTab |
| … | … | See `scripts/migrate-pages-to-features.mjs` |

## Routes

Compact paths: `/overview`, `/endpoints`, `/detections`, `/investigation`, `/response`, `/hunting`, `/protection`, `/admin`.

Legacy URLs redirect via `src/routes/legacyRedirects.js`.
