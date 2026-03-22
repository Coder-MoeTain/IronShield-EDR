# CrowdStrike Falcon–class UI — Phase 5 (multi-tenant enrollment)

Phase 5 aligns **agent enrollment** and the **host console** with Falcon-style **customer / tenant scope** (often shown as a **CID**-like slug in the UI).

## Agent (C#)

- **`TenantSlug`** in `config.json` (optional), or environment variable **`EDR_TENANT_SLUG`**.
- On **registration only**, the agent sends **`tenant_slug`** when configured. The server must have a matching **active** tenant (`tenants.slug`).
- Omit `TenantSlug` to enroll into the **default** tenant (usually slug `default`).

## Server

1. **Database** — ensure `tenants` exists and `endpoints.tenant_id` is present:

   ```bash
   cd server-node && npm run migrate-phase5-endpoints-tenant
   ```

   Or apply `schema-phase5.sql` + this migration on existing databases.

2. **Registration** — `POST /api/agent/register` accepts optional `tenant_slug`. Unknown slug → **400** `Unknown tenant slug`.

3. **API** — `GET /api/admin/endpoints` and host detail include **`tenant_name`** and **`tenant_slug`** (from `LEFT JOIN tenants`).

## Dashboard

| Page | Changes |
|------|---------|
| **All hosts** | **Tenant (CID)** column showing `tenant_slug` |
| **Host detail** | Tenant (CID) in **System info** + subtitle when slug is present |

## Verification

- Create a tenant under **Enterprise → Tenant management** (e.g. slug `acme`).
- Set agent `TenantSlug` to `acme` and register a new endpoint; confirm slug appears on the host list and detail page.

## Notes

CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.

See also: [Phase 4 — sensor telemetry](crowdstrike-ui-phase4.md), [Phase 6 — sensor updates](crowdstrike-ui-phase6.md).
