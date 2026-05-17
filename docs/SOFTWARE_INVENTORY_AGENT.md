# Software Inventory Agent

The Windows agent collects installed software from registry uninstall keys and uploads deltas to the platform.

## Configuration (`AgentConfig`)

| Setting | Default | Description |
|---------|---------|-------------|
| `SoftwareInventoryEnabled` | `true` | Enable collection loop |
| `SoftwareInventoryIntervalHours` | `24` | Scan interval |
| `SoftwareInventoryIncludeUserApps` | `true` | Include HKCU uninstall keys |
| `SoftwareInventoryIncludeExecutablePaths` | `false` | Resolve executable paths (slower) |

## Collection

`SoftwareInventoryCollector` reads:

- `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKLM\SOFTWARE\WOW6432Node\...\Uninstall`
- `HKCU\...\Uninstall` (when enabled)

**Never** uses WMI `Win32_Product` (slow, triggers consistency checks).

Fingerprints are SHA-256 of normalized name, vendor, version, install location, and endpoint ID.

## Upload

`POST /api/v1/agent/software-inventory`

```json
{
  "scan_type": "delta",
  "inventory_scan_id": "uuid",
  "software": [{ "name", "vendor", "version", "fingerprint", "install_location" }],
  "removed_fingerprints": []
}
```

Response envelope: `{ "success": true, "data": { "added", "updated", "removed" } }`.

## Policy poll

`GET /api/v1/agent/software-policies` returns:

- `block_policies` — active tenant policies
- `protected_processes` — allowlist (must match backend)
- `pending_notifications` — user messages to display
- `pending_refresh` — true when refresh remediation is queued

## Block enforcement

`SoftwareBlockEnforcer` runs on process creation. Skips protected processes and IronShield paths. Posts results to `POST /api/v1/agent/software-policy-result`.

## Testing

```bash
cd server-node
npm run test:agent-software
```
