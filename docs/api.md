# IronShield EDR API Documentation

Base URL: `https://your-host` (TLS required in production)

## API versioning

All routes are available under **two prefixes**:

| Prefix | Use |
|--------|-----|
| `/api/v1/*` | **Preferred** for new integrations and the SOC dashboard |
| `/api/*` | Legacy alias (backward compatible) |

OpenAPI contract: `GET /api/openapi.json` and `GET /api/v1/openapi.json`

Example: `POST /api/v1/auth/login` ≡ `POST /api/auth/login`

## Standard response envelope (admin / errors)

Many admin routes return:

```json
{
  "success": true,
  "data": { },
  "requestId": "uuid"
}
```

Errors:

```json
{
  "success": false,
  "error": { "code": "AUTHENTICATION_REQUIRED", "message": "..." },
  "requestId": "uuid"
}
```

## Production agent authentication

| Control | Header / mechanism |
|---------|-------------------|
| Agent key | `X-Agent-Key` (raw key shown **once** at registration; server stores `agent_key_hash` only) |
| Request signing | `X-Agent-Timestamp`, `X-Agent-Nonce`, `X-Agent-Signature`, `X-Agent-Body-Sha256` |
| mTLS (optional) | Client certificate; fingerprint bound to `endpoints.cert_fingerprint` |
| Replay protection | Nonce store: Redis (`AGENT_NONCE_STORE=redis`) or MySQL `agent_nonces` |

---

## Agent API

Paths below show `/api/v1/agent/...`. Replace with `/api/agent/...` if needed.

### POST /api/v1/agent/register

Register a new endpoint. Returns agent key **once** for future requests.

**Headers:**
- `X-Registration-Token`: Bootstrap or per-tenant enrollment token
- `Content-Type`: application/json

**Request:**
```json
{
  "hostname": "WORKSTATION01",
  "os_version": "Windows 10 22H2",
  "logged_in_user": "john",
  "ip_address": "192.168.1.100",
  "mac_address": "00:11:22:33:44:55",
  "agent_version": "1.0.0",
  "tenant_slug": "acme-corp"
}
```

**Response (201):**
```json
{
  "agentKey": "64-char-hex-string",
  "endpointId": 1
}
```

Store the key securely on the agent (Windows DPAPI). It cannot be retrieved again from the server.

**Errors:** 403 invalid token · 400 validation

---

### POST /api/v1/agent/heartbeat

**Headers:** `X-Agent-Key` (+ signing headers when `AGENT_REQUEST_SIGNING_REQUIRED=true`)

**Response (200):** `{ "endpointId": 1 }`

---

### POST /api/v1/agent/events/batch

Upload telemetry (idempotent via `event_id` and optional `batch_id`).

**Request:**
```json
{
  "batch_id": "unique-batch-id",
  "events": [
    {
      "event_id": "proc_123_2024-01-15T10:00:00Z",
      "hostname": "WORKSTATION01",
      "timestamp": "2024-01-15T10:00:00.000Z",
      "event_source": "ProcessMonitor",
      "event_type": "process_create",
      "process_name": "notepad.exe",
      "process_id": 1234,
      "command_line": "notepad.exe",
      "username": "john"
    }
  ]
}
```

**Response:** `{ "inserted": 1 }` or `{ "inserted": 0, "deduped": true }`

---

### GET /api/v1/agent/actions/pending

Pending response actions. When signing is enabled, each action includes `command_signature` and `command_expires_at`.

---

### POST /api/v1/agent/actions/:id/result

Submit action outcome. Body: `{ "success": true, "message": "...", "result": {} }`

---

### POST /api/v1/agent/key/rotate

**Response:** `{ "agent_key": "new-64-char-hex" }`

---

### GET /api/v1/agent/update/check

Agent update channel (version, download URL, checksum, signature).

---

## Admin API (JWT)

All admin routes: `Authorization: Bearer <token>`

Tenant scoping: super_admin may send `X-Tenant-Id: <id>`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Username/password (+ optional MFA) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Current user + permissions |
| GET | `/api/v1/auth/sso/oidc/start` | OIDC redirect |
| GET | `/api/v1/auth/sso/oidc/callback` | OIDC callback |
| POST | `/api/v1/auth/mfa/setup` | MFA enrollment |

---

### SOC core

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/dashboard/summary` | KPI summary |
| GET | `/api/v1/admin/endpoints` | List endpoints |
| GET | `/api/v1/admin/endpoints/:id` | Endpoint detail (trust: cert fingerprint, key age) |
| GET | `/api/v1/admin/endpoints/:id/process-timeline` | Host timeline |
| GET | `/api/v1/admin/alerts` | List alerts |
| GET | `/api/v1/admin/alerts/:id` | Alert detail incl. `why_fired`, `detection_score_breakdown` |
| PATCH | `/api/v1/admin/alerts/:id` | Status, assignment, disposition |
| GET | `/api/v1/admin/incidents` | Incidents |
| GET | `/api/v1/admin/investigations` | Investigations |

---

### Detection & MITRE

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/detection-rules` | DB-backed rules |
| GET | `/api/v1/admin/mitre/coverage` | MITRE ATT&CK coverage matrix |
| GET | `/api/v1/admin/analytics/rare-paths` | Rare process paths |

Detection-as-code rules ship in `server-node/detections/` (validated via `npm run detections:validate`).

---

### Response & approvals

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/admin/endpoints/:id/actions` | Create response action |
| GET | `/api/v1/admin/response-actions/approvals/pending` | Pending approvals |
| POST | `/api/v1/admin/response-actions/:id/approve` | Approve (two-person rule) |
| POST | `/api/v1/admin/response-actions/:id/deny` | Deny |

See [response-actions.md](response-actions.md).

---

### Enterprise & operations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/system/health` | DB, Redis, queue, endpoints |
| GET | `/api/v1/admin/integrations` | Webhook / Splunk HEC integrations |
| POST | `/api/v1/admin/integrations` | Create integration |
| GET | `/api/v1/admin/reports` | Report jobs |
| POST | `/api/v1/admin/reports` | Generate report (JSON/HTML) |
| GET | `/api/v1/admin/audit-logs` | Audit trail |
| GET | `/api/v1/admin/audit-logs/verify` | Hash-chain verification |
| GET | `/api/v1/admin/mssp/overview` | MSSP tenant overview |

---

### Network & hunting

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/network/summary` | Network KPIs |
| GET | `/api/v1/admin/network/connections` | Connections |
| GET | `/api/v1/admin/hunt-queries` | Saved hunts |
| POST | `/api/v1/admin/hunt-queries/run-adhoc` | Ad-hoc hunt |

---

### XDR & AV

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/xdr/events` | XDR events |
| GET | `/api/v1/admin/xdr/detections` | XDR detections |
| GET | `/api/v1/admin/av/detections` | AV detections |

---

### Ingest (external)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/ingest/events` | `X-Xdr-Ingest-Key` | External XDR event ingest |

---

## Health & metrics

| Path | Auth | Description |
|------|------|-------------|
| `GET /healthz` | None | Liveness |
| `GET /readyz` | None | Readiness (DB/Redis) |
| `GET /metrics` | `Authorization: Bearer <METRICS_TOKEN>` | Prometheus metrics |

---

## HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Server error |

---

## Related docs

- [detection-engine.md](detection-engine.md)
- [response-actions.md](response-actions.md)
- [SECURITY_MODEL.md](SECURITY_MODEL.md)
- [deployment-production.md](deployment-production.md)
- OpenAPI: `server-node/openapi/openapi.json`
