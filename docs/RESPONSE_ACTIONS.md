# IronShield EDR — Response Actions

Defensive, tenant-scoped, permission-checked, and audited endpoint response capabilities.

## Actions

| Action | Risk | Approval |
|--------|------|----------|
| collect_triage_package | Low | Auto / optional |
| kill_process | High | Separate approver |
| quarantine_file | High | Separate approver |
| isolate_host / unisolate_host | High | Separate approver |
| block_hash / unblock_hash | Medium | Policy-based |
| block_ip / unblock_ip | Medium | Policy-based |
| update_policy | Medium | Tenant admin |
| run_approved_script | High | Approved script registry |
| software block/unblock | High | SoD — requester cannot approve own block |

## Signed commands

The server signs pending commands with HMAC-SHA256. Agents verify signatures before execution.

- Production: `RESPONSE_COMMAND_SIGNING_REQUIRED=true`
- Agent: `RequireSignedResponseCommands: true` in config

## RTR (Remote Terminal Response)

- Disabled by default (`RTR_ENABLED=false`)
- Allowlisted commands only — no arbitrary shell
- Session and command timeouts, output limits, full transcript audit
- Permission: `response:rtr`

See also [response-actions.md](response-actions.md) (legacy path).
