# Agent mTLS enrollment (optional)

IronShield supports optional mutual TLS between the Windows agent and the API.

## Server

Set in environment or reverse proxy:

- `TLS_ENABLED=true` with `TLS_KEY_PATH`, `TLS_CERT_PATH`, optional `TLS_CA_PATH`
- `AGENT_MTLS_REQUIRED=true` to reject agents without a client certificate
- `ENFORCE_AGENT_MTLS_IN_PRODUCTION=true` (default) fails startup if mTLS is required but not configured

## Agent (`config.json`)

```json
{
  "ServerUrl": "https://edr.example.com",
  "RequireHttps": true,
  "ClientCertificatePfxPath": "C:\\ProgramData\\IronShield\\agent-client.pfx",
  "ClientCertificatePfxPassword": "use-dpapi-or-secret-store"
}
```

Pin server certificates with `PinnedServerCertThumbprints` when not using public CAs.

## Enrollment flow

1. Issue enrollment token (single-use recommended) in SOC → Tenants → Enrollment tokens.
2. Agent registers with token + optional `TenantSlug`.
3. Server returns `agent_key` (stored via DPAPI) and `endpoint_id`.
4. Enable request signing in production; verify with `GET /api/agent/ping`.

## Operational notes

- Rotate agent keys via `POST /api/agent/rotate-key` after compromise.
- Nonces for signed requests are stored in MySQL (`agent_nonces`) by default; set `AGENT_NONCE_STORE=memory` only for single-node dev.
