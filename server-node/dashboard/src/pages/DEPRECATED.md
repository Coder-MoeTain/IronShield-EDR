# Legacy page wrappers

Canonical UI lives under `src/features/<module>/`.

## Kept in `src/pages`

| File | Purpose |
|------|---------|
| `Login.jsx` | Authentication |
| `NotFound.jsx` | 404 |
| `*.jsx` re-exports | Temporary backward compatibility for bookmarks and tests |

## Detail routes (implementation in features)

| Legacy path / page | Feature module | Implementation |
|--------------------|----------------|----------------|
| `DetectionRuleEditor.jsx` | detections | `features/detections/DetectionRuleEditorPage.jsx` |
| `DetectionRuleDetail.jsx` | detections | `features/detections/DetectionRuleDetailPage.jsx` |
| `EventDetail.jsx` | hunting | `features/hunting/EventDetailPage.jsx` |
| `NormalizedEventDetail.jsx` | hunting | `features/hunting/NormalizedEventDetailPage.jsx` |
| `AvDetectionDetail.jsx` | protection | `features/protection/AvDetectionDetailPage.jsx` |
| `FalconRoadmapPage.jsx` | admin | `features/admin/tabs/FalconRoadmapPageTab.jsx` |

## Compact console modules

| Route | Feature page |
|-------|----------------|
| `/overview` | `features/overview/OverviewPage.jsx` |
| `/endpoints` | `features/endpoints/EndpointsPage.jsx` |
| `/detections` | `features/detections/DetectionsPage.jsx` |
| `/investigation` | `features/investigation/InvestigationPage.jsx` |
| `/response` | `features/response/ResponsePage.jsx` |
| `/hunting` | `features/hunting/HuntingPage.jsx` |
| `/protection` | `features/protection/ProtectionPage.jsx` |
| `/admin` | `features/admin/AdminPage.jsx` |

Legacy URLs redirect via `src/routes/legacyRedirects.js` (e.g. `/alerts` → `/detections?tab=alerts`).
