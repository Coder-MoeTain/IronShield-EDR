# IronShield EDR API Documentation

Base URL: `http://localhost:3000` (or your server)

---

## Agent API

### POST /api/agent/register

Register a new endpoint. Returns agent key for future requests.

**Headers:**
- `X-Registration-Token`: Bootstrap registration token
- `Content-Type`: application/json

**Request:**
```json
{
  "hostname": "WORKSTATION01",
  "os_version": "Windows 10 22H2",
  "logged_in_user": "john",
  "ip_address": "192.168.1.100",
  "mac_address": "00:11:22:33:44:55",
  "agent_version": "1.0.0"
}
```

**Response (201):**
```json
{
  "agentKey": "64-char-hex-string",
  "endpointId": 1
}
```

**Errors:**
- 403: Invalid registration token
- 400: Hostname required

---

### GET /api/agent/update/check

Check for agent updates (targeted by tenant + rollout ring).

**Headers:** `X-Agent-Key`, optional `X-Agent-Version`

**Query:**
- `version`: current agent version

**Response (200):**
```json
{
  "update_available": true,
  "version": "1.2.3",
  "download_url": "https://...",
  "checksum_sha256": "64-hex",
  "signature_base64": "base64-or-null",
  "ring": "stable",
  "health_gate": null
}
```

### POST /api/agent/key/rotate

Rotate agent key (server issues a new key; old key becomes invalid).

**Headers:** `X-Agent-Key`

**Response (200):**
```json
{
  "agent_key": "64-char-hex-string"
}
```

### POST /api/agent/heartbeat

Send heartbeat. Requires agent key.

**Headers:**
- `X-Agent-Key`: Agent key from registration
- `Content-Type`: application/json

**Request:**
```json
{
  "hostname": "WORKSTATION01",
  "os_version": "Windows 10",
  "logged_in_user": "john",
  "ip_address": "192.168.1.100",
  "mac_address": "00:11:22:33:44:55",
  "agent_version": "1.0.0"
}
```

**Response (200):**
```json
{
  "endpointId": 1
}
```

---

### POST /api/agent/events/batch

Upload batch of telemetry events.

**Headers:**
- `X-Agent-Key`: Agent key
- `Content-Type`: application/json

**Request:**
```json
{
  "batch_id": "unique-batch-id-for-idempotency",
  "events": [
    {
      "event_id": "proc_123_2024-01-15T10:00:00Z",
      "hostname": "WORKSTATION01",
      "timestamp": "2024-01-15T10:00:00.000Z",
      "event_source": "ProcessMonitor",
      "event_type": "process_create",
      "process_name": "notepad.exe",
      "process_id": 1234,
      "username": "john"
    }
  ]
}
```

**Response (200):**
```json
{
  "inserted": 1
}
```

If `batch_id` is re-sent for the same endpoint, the server responds with:

```json
{
  "inserted": 0,
  "deduped": true
}
```

---

### POST /api/agent/key/rotate

Rotate agent key (server issues a new key; old key becomes invalid).

**Headers:** `X-Agent-Key`

**Response (200):**
```json
{
  "agent_key": "64-char-hex-string"
}
```

---

### GET /api/agent/actions/pending

Get pending response actions for the agent.

**Headers:** `X-Agent-Key`

**Response (200):**
```json
{
  "actions": [
    {
      "id": 1,
      "action_type": "kill_process",
      "parameters": { "process_id": 1234 },
      "status": "pending"
    }
  ]
}
```

---

### POST /api/agent/actions/:id/result

Submit result of a response action.

**Request:**
```json
{
  "success": true,
  "message": "Process terminated",
  "result": null
}
```

For `collect_triage`, `result` contains processes, services, startup entries.

---

## Admin API (JWT Required)

All admin endpoints require: `Authorization: Bearer <token>`

### POST /api/auth/login

**Request:**
```json
{
  "username": "admin",
  "password": "ChangeMe123!",
  "mfa_code": "123456"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "super_admin"
  }
}
```

If MFA is required and `mfa_code` is missing/invalid:
```json
{
  "error": "MFA required",
  "mfa_required": true
}
```

### SSO federation

- `GET /api/auth/sso/oidc/start` - starts OIDC redirect flow.
- `GET /api/auth/sso/oidc/callback` - OIDC callback, issues local JWT session.
- `POST /api/auth/sso/saml/acs` - SAML ACS proxy endpoint (trusted gateway mode).

### MFA management

- `GET /api/auth/mfa/status`
- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/enable` with `{ "code": "123456" }`
- `POST /api/auth/mfa/disable` with `{ "code": "123456" }`

---

### GET /api/admin/dashboard/summary

**Response:**
```json
{
  "endpoints": { "total": 5, "online": 3, "offline": 2 },
  "eventsToday": 1250,
  "newAlerts": 2
}
```

---

### GET /api/admin/endpoints

**Query params:** hostname, status, limit, offset

**Response:** Array of endpoint objects

---

### GET /api/admin/endpoints/:id

**Response:** Single endpoint with full details

---

### GET /api/admin/events

**Query params:** endpointId, hostname, eventType, username, processName, dateFrom, dateTo, limit, offset

**Response:**
```json
{
  "events": [...],
  "total": 500
}
```

---

### GET /api/admin/alerts

**Query params:** `endpointId`, `severity`, `status`, `assigned_to`, `assigned_team`, `dateFrom`, `dateTo`, `limit`, `offset`

**Response:**
```json
{
  "alerts": [ /* ... */ ],
  "summary": { "new": 0, "investigating": 0, "total": 0 }
}
```

---

### PATCH /api/admin/alerts/:id

Partial update (requires `alerts:write` or `*`). Fields: `status`, `assigned_to`, `assigned_team`, `due_at` (ISO datetime), `sla_minutes`, or **`suppression_reason`** (non-empty string sets status to `false_positive`, records `suppressed_by` / `suppressed_at`).

---

### POST /api/admin/alerts/:id/status

Legacy status update (still supported).

**Request:**
```json
{
  "status": "investigating",
  "assigned_to": "analyst1"
}
```

---

### GET /api/admin/saved-views

**Query params:** `page` (e.g. `detections`) — user-scoped saved filter presets.

### POST /api/admin/saved-views

**Request:** `{ "name": "My triage", "page": "detections", "filters": { "status": "new", "severity": "high" } }`

### DELETE /api/admin/saved-views/:id

---

### GET /api/admin/export/siem-alerts

NDJSON stream of alerts for SIEM pipelines (requires `audit:read` or `*`). Optional query: `since` (ISO or MySQL datetime).

---

### GET /api/admin/analytics/rare-paths

Rare process paths for an endpoint (anomaly-style signal). **Query:** `endpointId` (required), `days`, `limit`, `maxCount`.

---

### POST /api/admin/endpoints/:id/actions

Create response action.

**Request:**
```json
{
  "action_type": "kill_process",
  "parameters": { "process_id": 1234 }
}
```

Action types include: `kill_process`, `request_heartbeat`, `isolate_host`, `lift_isolation`, `mark_investigating`, `collect_triage`, `quarantine_file`, `block_ip`, `block_hash`, `run_script`

### PATCH /api/admin/endpoints/:id

Update endpoint metadata. **Body:** `{ "host_group_id": <number> | null }` (requires `migrate-cs-parity`).

### GET /api/admin/host-groups

List host (sensor) groups for the tenant.

### POST /api/admin/host-groups

**Body:** `{ "name": "...", "description": "..." }`

### PATCH /api/admin/host-groups/:id

### DELETE /api/admin/host-groups/:id

### GET /api/admin/hunt-queries

Saved threat-hunt definitions (`schema-phase4`).

### POST /api/admin/hunt-queries

**Body:** `{ "name": "...", "query_params": { "eventType": "", "hostname": "", "processName": "", "commandLine": "", "dnsQuery": "", "dateFrom": "", "dateTo": "", "limit": 50 } }`

### DELETE /api/admin/hunt-queries/:id

### POST /api/admin/hunt-queries/:id/run

Execute a saved hunt; stores a row in `hunt_results`.

### POST /api/admin/hunt-queries/run-adhoc

**Body:** same shape as `query_params` above — run without saving.

### GET /api/admin/sensors/health

Aggregated sensor connectivity and agent version distribution.

### MSSP operations

- `GET /api/admin/mssp/overview` — Internal MSSP overview: per-tenant endpoint counts, online endpoints, open alerts, and open investigations. Scoped by tenant context (`X-Tenant-Id` for super_admin); global list when unscoped.

**Response (201):**
```json
{
  "id": 1
}
```

---

## HTTP Status Codes

- 200: Success
- 201: Created
- 400: Bad request / validation error
- 401: Unauthorized (missing or invalid token)
- 403: Forbidden
- 404: Not found
- 429: Rate limited
- 500: Server error
