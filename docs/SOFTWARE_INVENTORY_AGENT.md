# Software Inventory — Windows Agent

## Collection sources

- `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall` (when `SOFTWARE_INVENTORY_INCLUDE_USER_APPS=true`)

**Not used:** `Win32_Product` WMI class (can trigger MSI repair).

## Config (`config.json` / environment)

| Setting | Default |
|---------|---------|
| `SoftwareInventoryEnabled` | `true` |
| `SoftwareInventoryIntervalHours` | `24` |
| `SoftwareInventoryIncludeUserApps` | `true` |
| `SoftwareInventoryIncludeExecutablePaths` | `true` |

## Fingerprint

`SHA256(normalized_name|vendor|version|install_location|endpoint_id)` — stable per endpoint install.

## Upload

`POST /api/v1/agent/software-inventory` with `scan_type` `full` or `delta`, `software[]`, and `removed_fingerprints[]`.

Server responds with `{ added, updated, removed }` summary (audit only; full payload not stored in audit).
