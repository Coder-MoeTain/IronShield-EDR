# Software Block Policy

## Safety principles

- Policy-based, visible, reversible, tenant-scoped, audited.
- Protected processes are never blocked (System, lsass, winlogon, explorer by default, IronShield agent, common AV processes).
- High-risk policies (browser block, wildcard path, security tool) require approval.

## Agent behavior

On `process_create`, agent evaluates enabled policies from `GET /api/v1/agent/software-policies`:

| Action | Behavior |
|--------|----------|
| `audit_only` | Report event only |
| `warn` | Log + optional user message |
| `block` | Terminate process (non-system) + report |

Events posted to `POST /api/v1/agent/software-policy-result`.

## Admin API

- `POST /api/v1/software/block-policies` — create policy
- `POST /api/v1/software/inventory/:id/block` — block specific installed software on endpoint
