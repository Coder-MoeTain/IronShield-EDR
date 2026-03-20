# IronShield EDR Antivirus Engine Architecture

## Overview

The antivirus (AV) module is a **defensive-only** malware detection engine integrated into the IronShield EDR platform. It provides file scanning, signature matching, heuristic analysis, quarantine, and correlation with EDR alerts.

**Scope:** Detection, scoring, quarantine, and reporting of potentially malicious files and processes. No offensive, evasive, or malware-delivery functionality.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WINDOWS EDR AGENT (C# .NET 8)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ RealtimeScan    │  │ ScheduledScan   │  │ ScanTaskExecutor             │ │
│  │ Watcher         │  │ Service         │  │ (on-demand from backend)     │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘ │
│           │                    │                            │                │
│           └────────────────────┼────────────────────────────┘                │
│                                ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ FileScanService                                                        │  │
│  │   ├── ExclusionEvaluator (path, hash, extension, signer)               │  │
│  │   ├── SignatureMatcher (hash, path/filename, binary pattern)          │  │
│  │   ├── HeuristicEngine (suspicious path, double-ext, entropy, etc.)    │  │
│  │   └── PeMetadataReader (sections, imports, timestamp, signer)           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                │                                             │
│  ┌────────────────────────────┴─────────────────────────────────────────┐  │
│  │ QuarantineService (move, optional encrypt, restore, delete)             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                │                                             │
│  ┌────────────────────────────┴─────────────────────────────────────────┐  │
│  │ SignatureUpdateService (fetch, cache, version check)                    │  │
│  │ AvTaskPollingService (pending tasks, submit results)                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTPS (X-Agent-Key)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NODE.JS BACKEND (Express)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Agent APIs                    │  Admin APIs                                 │
│  GET /av/policy                 │  GET /av/dashboard/summary                │
│  GET /av/signatures/version     │  GET /av/detections, /av/detections/:id    │
│  GET /av/signatures/download     │  GET /av/quarantine                        │
│  POST /av/scan-result           │  POST /av/quarantine/:id/restore|delete     │
│  POST /av/quarantine-result      │  GET|POST|PUT /av/policies                 │
│  POST /av/update-status          │  GET|POST|PUT /av/signatures               │
│  GET /av/tasks/pending           │  POST /av/scan-task                        │
│  POST /av/tasks/:id/result       │  GET /av/scan-tasks                        │
│                                  │  GET /av/updates/status                    │
│                                  │  GET /av/reputation?sha256=...             │
│                                  │  GET|POST /av/exclusions                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MySQL 8+                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  av_signatures, av_signature_bundles, av_bundle_signatures                   │
│  av_scan_policies, av_scan_tasks, av_scan_results                            │
│  av_quarantine_items, av_exclusions, av_update_status                        │
│  malware_alerts (links to EDR alerts)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detection Flow

1. **File event** (create/modify/execute) or **scheduled/on-demand scan** triggers scan.
2. **ExclusionEvaluator** checks path, hash, extension, signer against exclusions → skip if matched.
3. **FileHashService** computes SHA256 (optionally MD5/SHA1 for compatibility).
4. **SignatureMatcher** checks:
   - Hash (exact match)
   - Path/filename (regex or substring)
   - Binary pattern (bounded scan, max 1MB)
5. **HeuristicEngine** scores file:
   - Unsigned executable in temp/downloads/startup
   - Double extension
   - Script in startup
   - High entropy in suspicious path
   - Misleading extension
6. **PeMetadataReader** (PE files): sections, imports, timestamp, signer.
7. **Score aggregation**: Signature hit → high confidence. Heuristics → weighted score.
8. If score ≥ alert_threshold → report. If ≥ quarantine_threshold → quarantine.

---

## Scoring Model

| Source           | Confidence | Example Score |
|------------------|------------|---------------|
| Signature hit    | Highest    | 95–100        |
| Hash reputation  | High       | 90            |
| Multiple heuristics | Medium  | 50–85         |
| Single heuristic | Low        | 20–40         |

**Dispositions:** clean, suspicious, malicious, quarantined, restored, false_positive  
**Severities:** low, medium, high, critical

---

## Quarantine Workflow

1. Move file to `%ProgramData%\EDR\EDR_Quarantine\`.
2. Rename to `{quarantine_id}{ext}.quarantine`.
3. Optional: encrypt at rest (AES).
4. Record in `av_quarantine_items` (original_path, sha256, detection_name).
5. Restore: admin marks restored → agent restores on next poll (or via restore task).
6. Delete: admin marks deleted → agent deletes file.

---

## Integration with EDR

- **Malware alerts** → create EDR alert via `AlertService.createFromDetection()`.
- **Correlation:** malicious file + process execution, same hash on multiple endpoints.
- **Risk:** `RiskService` uses malware alerts for endpoint risk score.
- **Incidents:** `CorrelationService` correlates AV detections with other alerts.

---

## Safety Restrictions

The AV module does **not** include:
- Malware creation, payload execution, ransomware simulation
- Code injection, process hollowing, rootkit behavior
- Evasion logic, persistence abuse, credential dumping
- Exploit code, polymorphic engines, packers, crypters, droppers, loaders

---

## File Locations

| Component        | Path |
|-----------------|------|
| C# Agent AV      | `agent-csharp/src/EDR.Agent.Core/Antivirus/` |
| Node.js AV       | `server-node/src/modules/antivirus/` |
| DB Schema        | `database/schema-antivirus.sql` |
| Dashboard AV     | `server-node/dashboard/src/pages/Av*.jsx` |
