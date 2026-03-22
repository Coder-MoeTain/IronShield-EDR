# Falcon-style Network activity (IronShield)

This document describes how the **Network** dashboard page maps to a **CrowdStrike Falcon**–style *network exploration* workflow: dense KPIs, scoped remote addresses, time-windowed aggregates, and tables optimized for SOC triage.

## UI (Explore → Network activity)

| Area | Behavior |
|------|----------|
| **KPI strip** | Single-call summary: total connections in window, unique remote IPs, hosts with activity, outgoing destinations (distinct remote IP/port/protocol/endpoint). Falls back to client-side sums if the summary API is unavailable. |
| **Toolbar** | Endpoint filter, time window (1h–7d), **Exclude localhost** (hides `::1`, `127.0.0.1`, `::ffff:127.0.0.1`), live refresh. |
| **Connection filters** | **Remote IP contains** and **Process name contains** — applied to the Connections table (and live refresh uses the same filters via refs). |
| **Tabs** | Segmented control: **Connections**, **Outgoing IPs**, **Traffic by endpoint**, **Network logs**. |
| **Scope column** | IPv4-oriented badges: **RFC1918** (private), **External** (public unicast), **Loopback** — helps prioritize outbound exposure vs internal chatter. |
| **IOC follow-up** | Quick link to the IOC watchlist for blocking/watching indicators discovered during review. |

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/network/summary` | KPI JSON: `total_connections`, `unique_remote_ips`, `hosts_with_activity`, `outgoing_destinations`. Query: `hours`, `endpointId`, `excludeLocalhost`. |
| `GET` | `/api/admin/network/connections` | Paginated connections; supports `hours`, `remoteAddress`, `processName`, `excludeLocalhost`, `endpointId`. |
| `GET` | `/api/admin/network/outgoing-ips` | Aggregated outgoing rows per destination + endpoint + process. |
| `GET` | `/api/admin/network/traffic` | Per-endpoint traffic rollups. |
| `GET` | `/api/admin/network/logs` | Bundle of `network_connections`-backed rows + `normalized_events` network-ish events; supports `hours` and `excludeLocalhost`. |

All routes require admin auth (same as other `/api/admin/*` handlers).

## Parity notes (Falcon vs IronShield)

- **Falcon** exposes rich graphing, geo, and firewall-adjacent context; IronShield focuses on **telemetry-backed tables** and **IOC linkage** first.
- Scope badges are **heuristic** (IPv4 RFC1918 / non-RFC1918); IPv6 beyond loopback is shown without a scope badge until extended classification is added.

## Related

- [Falcon-class feature map](falcon-parity-features.md)
- [Falcon-style UI Phase 1](crowdstrike-ui-phase1.md)
