# IronShield EDR — Security Model

## Trust boundaries

- **SOC users** authenticate with JWT (optional MFA/OIDC/SAML). RBAC + tenant context gate admin APIs.
- **Agents** authenticate with per-endpoint `agent_key` and optional request signing. No offensive tooling is shipped.
- **Integrations** export alert metadata only; credentials stored in `integrations.config_json` (redacted in audit logs).

## Agent authentication

| Control | Purpose |
|---------|---------|
| Registration token | Bootstrap only; prefer single-use enrollment tokens |
| Agent key | Long-lived endpoint secret; rotate via API |
| Request signing | Replay protection + body integrity |
| DPAPI | Protect agent key at rest on Windows |
| mTLS (optional) | Client certificate for agent transport — see `docs/security/agent-mtls-enrollment.md` |

Production defaults (`NODE_ENV=production`):

- `AGENT_REQUEST_SIGNING_REQUIRED` defaults to **true** unless explicitly set `false`.
- Weak `JWT_SECRET` / `AGENT_REGISTRATION_TOKEN` values are rejected at startup.

## Response actions

High-risk actions may require approval. Commands dispatched to agents include HMAC signatures verified with the endpoint `agent_key`. Expired commands are rejected.

## Audit

Administrative actions append to `audit_logs` with optional hash chain verification (`npm run audit:verify`).

## Out of scope

IronShield does not provide exploit development, C2 frameworks, or unauthorized access capabilities.
