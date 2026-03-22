# Agent service hardening (Windows)

User-mode hardening for the IronShield Windows agent service. This is **not** kernel-level tamper protection; it improves resilience against accidental stops and complements policy controls (e.g. WDAC — see `wdac-hardening.md`).

## Service recovery on failure

`agent-csharp/install-service.ps1` configures Windows **Service Control Manager** failure actions so the agent restarts after an unexpected exit:

- `sc failure` — reset counter after 24h; up to three restarts with 60s delay between attempts.
- `sc failureflag` — write failures to the System event log.

Run the installer **elevated** so these commands succeed. If you installed the service manually, you can apply the same `sc` lines from the script.

## Script execution (`run_script`)

Remote script execution is restricted by:

1. **Path allowlist** — `ScriptAllowlistPrefixes` in `config.json`; only files under these prefixes run.
2. **Optional SHA-256 allowlist** — `ScriptAllowlistSha256`: when this array is **non-empty**, the agent hashes the script file and requires a **case-insensitive** hex match to one entry. When the array is **empty**, only the path check applies.

To obtain a hash on Windows (PowerShell):

```powershell
Get-FileHash -Algorithm SHA256 -Path "C:\IronShield\Scripts\MyScript.ps1" | Select-Object Hash
```

Paste the hex string(s) into `ScriptAllowlistSha256`.

## Related

- Dashboard: **Detection → Custom rules** → **Suppressions** tab; **Respond → Triage** → **Playbooks** tab (server DB migration: `npm run migrate-capabilities-v2` from `server-node`).
