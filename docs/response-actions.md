# Response actions

Defensive response capabilities executed on endpoints via signed commands from the server.

## High-risk actions (approval required)

These require a **second analyst** (two-person rule), justification, and audit:

- `isolate_host` / `lift_isolation` / `unisolate_host`
- `kill_process`
- `quarantine_file`
- `run_script` / `run_approved_script`
- `rtr_shell` (allowlisted commands only; disabled by default in policy)

## Command security

- Server signs each pending action with the endpoint `agent_key` (HMAC).
- Agent verifies signature and `command_expires_at` before execution.
- Expired or tampered commands are rejected and reported.

## RTR (Real Time Response)

- Session-based allowlisted commands only — no arbitrary shell.
- Full audit trail in `audit_logs` and RTR session tables.
- Configure script allowlists on the agent (`ScriptAllowlistPrefixes`, `ScriptAllowlistSha256`).

## API

- Create: `POST /api/v1/admin/endpoints/:id/actions`
- Approvals: `GET /api/v1/admin/response-actions/approvals/pending`
- Approve/deny: see admin routes in [api.md](api.md)
