# Windows Defender Application Control (WDAC) — deployment notes

IronShield’s Windows agent runs in user mode without a kernel sensor. For **high-assurance** environments, combine the agent with **WDAC** (or AppLocker) policies so that only approved binaries can run and services cannot be trivially replaced.

## Suggested approach

1. **Baseline audit mode** — Deploy WDAC in audit-only mode, collect event logs, and build an allow list from real workload telemetry.
2. **Allow the IronShield agent** — Explicitly allow:
   - `EDR.Agent.Service.exe` and its dependencies from the install directory
   - Signed .NET runtime components as required by your policy model
3. **Restrict scripting** — Align with `ScriptAllowlistPrefixes` for `run_script` actions: only approved script directories should be writable by admins.
4. **Tamper protection** — Use WDAC + service ACLs so non-admin users cannot stop or replace the agent binaries.

## References

- [WDAC design guide (Microsoft)](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/windows-defender-application-control/wdac-design-guide)

This document is **guidance only**; test policies in audit mode before enforcement.
