# Falcon-class advanced UI (self-hosted)

This pack adds **first-party** surfaces inspired by CrowdStrike Falcon **workflows** — not cloud parity.

| Area | Implementation |
|------|----------------|
| **Real Time Response (RTR)** | Allowlisted shell (`rtr_shell` response action), **RTR** page, `rtr_sessions` / `rtr_session_commands` tables |
| **Threat graph** | Host ↔ alert links from recent data (`GET /api/admin/threat-graph`) |
| **Detection analytics** | Heuristic risk + bar chart + narratives (`GET /api/admin/analytics/detections-summary`) |
| **Roadmap pages** | Identity, Exposure, Managed hunting, Deep prevention, Integrations — **documentation placeholders** |

## Database

```bash
cd server-node && npm run migrate-falcon-ui-pack
```

## RTR allowlist

Agent executes only: `whoami`, `hostname`, `ipconfig`, `ver`, `systeminfo`, `netstat`, `route`, `arp`, `getmac`, `echo` (see `RtrShellExecutor.cs`).

## Policy

Add **`rtr_shell`** to the endpoint’s EDR policy **`allowed_response_actions`** JSON array (Policies in the console), or the agent will not execute queued commands.

## Legal

CrowdStrike® and Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.
