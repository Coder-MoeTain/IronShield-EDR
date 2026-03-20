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
  "password": "ChangeMe123!"
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

**Query params:** endpointId, severity, status, dateFrom, dateTo, limit, offset

**Response:** Array of alert objects

---

### POST /api/admin/alerts/:id/status

**Request:**
```json
{
  "status": "investigating",
  "assigned_to": "analyst1"
}
```

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

Action types: `kill_process`, `request_heartbeat`, `simulate_isolation`, `mark_investigating`, `collect_triage`

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
