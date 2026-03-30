# Antivirus engine — phased improvements

This document tracks **engineering improvements** to the IronShield AV stack (agent `FileScanService`, `HeuristicEngine`, `SignatureMatcher`, realtime/scheduled scans, Node APIs, dashboard). Each phase has a clear goal and exit criteria.

| Phase | Theme | Exit criteria |
|-------|--------|----------------|
| **1** | **Quality & contracts** | Core matcher/heuristic logic covered by unit tests; reputation service unit-tested with mocks; architecture doc cross-linked. **Done.** |
| **2** | **Noise & performance** | `av_scan_policies.realtime_debounce_seconds` (1–60, default 2) + agent `RealtimeScanWatcher` uses policy; `FileScanService` names `MaxDirectoryRecursionDepth` (4). Optional: per-hash dedupe window. **Debounce + depth naming done.** |
| **3** | **Detection depth** | Additional safe heuristics (documented); PE import hints expanded; binary pattern tests in CI. |
| **4** | **Operations** | Admin summary includes signature age / bundle version drift; agent update-status surfaced consistently. |
| **5** | **Enterprise** | Tenant-scoped exclusions sync contract tests; malware alert correlation hooks documented. |

## Phase 1 (current)

- **Agent (C#):** `SignatureMatcher` tests (hash, path, binary pattern). `HeuristicEngine` tests (OS-aware for path rules; `EstimateEntropy` on temp files).
- **Server (Node):** `fileReputationService.getReputation` — invalid input, signature branch, empty history branch (mocked `db` + `AvSignatureService.lookupHash`).

## Phase 2

- **Realtime:** Policy field `realtime_debounce_seconds` is stored in `av_scan_policies`, returned on `GET /api/agent/av/policy`, and applied in `RealtimeScanWatcher` (clamped 1–60; 0/missing → 2). Migration: `npm run migrate-av-realtime-debounce`.
- **Directory scans:** `FileScanService` uses a named constant for max recursion depth (4); exposing it in policy is a follow-up.

## Phase 3

- Extend `HeuristicEngine` rules with conservative, documented additions (e.g. additional misleading patterns) without raising false positives on dev tools.
- Integration tests for `MatchBinaryPattern` on small fixtures (EICAR-safe hex snippets).

## Phase 4

- Dashboard / API: fleet AV health (last signature sync, engines reporting).
- Align `HeartbeatService` NGAV telemetry fields with schema migrations where applicable.

## Phase 5

- RBAC and multi-tenant tests for `/av/exclusions` and policies.
- Document correlation between `malware_alerts` and EDR incidents.

---

See also: [antivirus-architecture.md](./antivirus-architecture.md), [antivirus-setup.md](./antivirus-setup.md).
