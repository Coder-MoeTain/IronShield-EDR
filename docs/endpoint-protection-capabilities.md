# Endpoint protection capability map

IronShield maps common **endpoint security product areas** to concrete platform features. This document mirrors the console page **Next-gen AV → Protection features** and the API `GET /api/admin/platform/protection-capabilities`.

## Principles

- **Honest status:** *Full* = shipped core path; *Partial* = subset or console-only; *Planned* = roadmap / requires extension.
- **No vendor lock-in:** Threat intelligence is described as **first-party signatures plus curated open feeds** — not a specific commercial TI cloud unless you integrate it.
- **API:** The JSON catalog is static logic in `server-node/src/modules/platform/protectionCapabilities.js` (versioned with the server).

## Feature areas (summary)

| # | Area | Typical expectation | IronShield |
|---|------|---------------------|------------|
| 1 | Malware & threat protection | Real-time AV, signatures | NGAV: realtime scan, signatures, heuristics, quarantine |
| 2 | Ransomware (basic) | Behavior + containment | Heuristics + quarantine; not a dedicated anti-ransomware driver |
| 3 | ML (basic) | Classifier | Heuristic + reputation; no bundled cloud ML model |
| 4 | Web & URL | Block bad sites | IOC URLs, intel feeds, telemetry — not a default browser filter |
| 5 | Email & content | Mailbox scanning | IOC-based; no built-in M365/Exchange agent |
| 6 | HIPS | Kernel prevention | Detection rules + EDR; not default-deny kernel HIPS |
| 7 | Application control | Whitelist | Policies + hash/signature control |
| 8 | Device control | USB block | **Partial:** Windows agent WMI + optional eject (`av_scan_policies`); not kernel deny |
| 9 | DLP (basic) | Content DLP | Audit/RBAC; not content classification |
| 10 | Endpoint coverage | Clients/servers | Windows agent reference |
| 11 | Centralized management | One console | Dashboard + admin APIs |
| 12 | Threat intelligence | Global feeds | Signature bundles + server-side feed jobs |
| 13 | Logging & visibility | SOC view | Alerts, investigations, audit |
| 14 | Multi-layer | Defense in depth | NGAV + rules + correlation |

See also: [antivirus-architecture.md](./antivirus-architecture.md), [antivirus-setup.md](./antivirus-setup.md).
