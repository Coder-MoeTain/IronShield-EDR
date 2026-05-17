# IronShield EDR — Production Readiness

**API:** `GET /api/v1/admin/platform/production-readiness`  
**UI:** Overview → System Health, Admin → System Health

## Score bands

| Score | Label |
|-------|--------|
| 0–59 | Demo only |
| 60–79 | Internal pilot |
| 80–89 | Enterprise pilot |
| 90–100 | Production ready |

In **production**, the score is **capped below 90** when any critical gate fails (mTLS, agent signing, response command signing, key pepper, Redis nonce, JWT/CORS/metrics, test artifacts present).

## Critical gates

- TLS and mTLS for agents
- Agent request HMAC signing
- Signed response commands (`RESPONSE_COMMAND_SIGNING_REQUIRED`)
- `AGENT_KEY_PEPPER` configured
- Durable nonce store (not in-memory)
- Audit hash chain table
- OpenAPI, envelope, RBAC, tenant, software, detection tests present

## Verify locally

```bash
cd server-node
npm run test:envelope
npm run test:openapi
npm run test:rbac
npm run test:tenant-isolation
npm run audit:verify
```

See [PROFESSIONAL_UPGRADE_AUDIT.md](PROFESSIONAL_UPGRADE_AUDIT.md) for the full upgrade checklist.
