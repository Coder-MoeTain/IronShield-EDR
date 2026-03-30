# IronShield EDR Antivirus Module - Setup Guide

## Overview

The antivirus (AV) module provides defensive malware detection integrated with the EDR platform. It includes file scanning, signature matching, heuristics, quarantine, and correlation with EDR alerts.

## Prerequisites

- MySQL 8+ with base EDR schema applied
- Node.js backend running
- Windows agent (C# .NET 8) deployed
- Dashboard (React) for admin UI

## Database Setup

Apply the antivirus schema and seed data:

```bash
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-antivirus.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/seed-antivirus.sql
```

**Schema order:** Run `schema-antivirus.sql` after `schema-phase6.sql` (or after your latest phase).

## Backend

The Node.js backend includes AV routes automatically. No extra configuration needed if the base EDR backend is running.

**Agent APIs** (require `X-Agent-Key`):
- `GET /api/agent/av/policy` - Fetch scan policy
- `GET /api/agent/av/signatures/version` - Signature bundle version
- `GET /api/agent/av/signatures/download` - Download signatures
- `POST /api/agent/av/scan-result` - Submit scan results
- `POST /api/agent/av/quarantine-result` - Submit quarantine events
- `POST /api/agent/av/update-status` - Report signature update status
- `GET /api/agent/av/tasks/pending` - Get pending scan tasks
- `POST /api/agent/av/tasks/:id/result` - Submit task result

**Admin APIs** (require JWT):
- `GET /api/admin/av/dashboard/summary` - Dashboard stats
- `GET /api/admin/av/detections` - List detections
- `GET /api/admin/av/detections/:id` - Detection detail
- `GET /api/admin/av/quarantine` - List quarantine items
- `POST /api/admin/av/quarantine/:id/restore` - Request restore
- `POST /api/admin/av/quarantine/:id/delete` - Mark deleted
- `GET /api/admin/av/policies` - List policies
- `POST /api/admin/av/policies` - Create policy
- `PUT /api/admin/av/policies/:id` - Update policy
- `GET /api/admin/av/signatures` - List signatures
- `POST /api/admin/av/signatures` - Create signature
- `PUT /api/admin/av/signatures/:id` - Update signature
- `GET /api/admin/av/exclusions` - List exclusions
- `POST /api/admin/av/exclusions` - Create exclusion
- `DELETE /api/admin/av/exclusions/:id` - Delete exclusion
- `GET /api/admin/av/reputation?sha256=...` - File reputation lookup
- `POST /api/admin/av/scan-task` - Create scan task
- `GET /api/admin/av/scan-tasks` - List scan tasks
- `GET /api/admin/av/malware-alerts` - List malware alerts
- `PATCH /api/admin/av/malware-alerts/:id/status` - Update alert status
- `GET /api/admin/av/updates/status` - Endpoint update status

## Agent

The C# agent polls for AV tasks and executes scans. Ensure the agent is registered and has a valid `X-Agent-Key`.

**Scan flow:**
1. Agent polls `GET /api/agent/av/tasks/pending`
2. For each pending task, scans configured directories
3. Submits results via `POST /api/agent/av/scan-result`
4. Quarantines files above threshold, reports via `POST /api/agent/av/quarantine-result`
5. Submits task completion via `POST /api/agent/av/tasks/:id/result`

**Device control (Windows):** When `device_control_enabled` is true, the agent watches for new volume mounts. For `removable_storage_action=audit|block`, it enqueues a `usb_removable_volume` telemetry event with `device_control` details. For `block`, it attempts to eject **removable** drives only (`DriveType.Removable`).

**Quarantine location:** `%ProgramData%\EDR\EDR_Quarantine\`

## Dashboard

Navigate to **Antivirus** in the sidebar. Available pages:

- **AV Overview** - Summary, recent detections, run scan
- **Detections** - Full detection list with filters
- **Quarantine** - Quarantine manager (restore/delete)
- **Scan Tasks** - Task history
- **Policies** - Scan policy management
- **Signatures** - Signature management
- **File Reputation** - SHA256 lookup
- **Malware Alerts** - Alert queue and review

## Sample Data

This project no longer ships sample AV seed data (EICAR, demo bundles) for enterprise safety.

To test: create signatures/policies via the admin UI/API and create a scan task for an endpoint.

## Signature Types

| Type    | Description                    | Example                    |
|---------|--------------------------------|----------------------------|
| hash    | Exact hash match               | SHA256 of known malware    |
| path    | Path/filename regex            | `.*\\\\temp\\\\.*\\.exe`   |
| filename| Filename pattern               | `suspicious.*`            |
| pattern | Binary hex pattern             | `4D5A` (MZ header)         |

## Policy Fields

- `realtime_enabled` - File system watcher for create/modify
- `scheduled_enabled` - Daily full scan
- `execute_scan_enabled` - Scan on execute (when supported)
- `quarantine_threshold` - Score ≥ this → quarantine (default 70)
- `alert_threshold` - Score ≥ this → report (default 50)
- `max_file_size_mb` - Skip files larger than this
- `realtime_debounce_seconds` - Cooldown between realtime scans of the same path (1–60)
- `device_control_enabled` - **Windows agent:** subscribe to WMI `Win32_VolumeChangeEvent` for new volumes
- `removable_storage_action` - `audit` (log + telemetry only), `block` (attempt `Win32_Volume.Eject` on removable drives), or `allow` (no device-control telemetry)
- `include_paths` - Directories to scan
- `exclude_paths` - Paths to skip
- `exclude_extensions` - Extensions to skip
- `exclude_hashes` - Hashes to skip (allowlist)

**USB / removable:** User-mode only; eject is best-effort. Drives that enumerate as **Fixed** may not be classified as removable. Apply migration `npm run migrate-av-device-control` on existing databases.

## Database migrations (AV)

- `npm run migrate-av-realtime-debounce` — `realtime_debounce_seconds` on `av_scan_policies`
- `npm run migrate-av-device-control` — `device_control_enabled`, `removable_storage_action`

## Exclusions

Exclusions bypass scanning. Types: `path`, `hash`, `process_name`, `signer`, `extension`, `policy_group`.

Create via API or (future) dashboard UI.

## Troubleshooting

**No detections:** Ensure signatures are loaded. Check `av_signature_bundles` has an active bundle and `av_bundle_signatures` links signatures.

**Agent not scanning:** Verify agent key, policy returns valid JSON, and scan task exists for the endpoint.

**Quarantine restore:** Restore marks the item in DB; the agent must process restore requests (future: restore task or on-demand command).
