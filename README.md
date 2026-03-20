<div align="center">
  <img src="assets/open-edr-banner.png" alt="IronShield EDR" width="100%">
</div>

<br>

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![.NET](https://img.shields.io/badge/.NET-8.0-purple.svg)
![MySQL](https://img.shields.io/badge/MySQL-8%2B-orange.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)

**IronShield EDR** — A defensive Windows Endpoint Detection and Response (EDR) platform for endpoint monitoring, security event analysis, and response simulation.

Built for lab and enterprise prototype use.

[Features](#-features) •
[Quick Start](#-quick-start) •
[Architecture](#-architecture) •
[API](#-api-overview) •
[Documentation](docs/)

</div>

---

## 📋 Overview

IronShield EDR is a full-stack security platform that combines telemetry collection, rule-based detection, real-time response actions, and a SOC-style dashboard. Deploy agents on Windows endpoints, ingest events, and analyze threats with built-in antivirus correlation and investigation workflows.

| Component | Tech Stack | Description |
|-----------|------------|-------------|
| **Windows Agent** | C# .NET 8 | Collects process events, Windows Event Log, network telemetry; sends to backend |
| **Backend API** | Node.js + Express | Event ingestion, detection engine, alerts, RBAC |
| **Database** | MySQL 8+ | Endpoints, events, alerts, rules, investigations |
| **Admin Dashboard** | React | SOC-style UI for monitoring, response, and triage |

---

## ✨ Features

### Core Capabilities

- **Endpoint Monitoring** — Process events, Windows Event Log, network connections, file hashing
- **Detection Engine** — JSON/Sigma-style rules with MITRE ATT&CK mapping
- **Response Actions** — Kill process, triage collection, isolation simulation
- **Alert Management** — Severity, status, notes, investigation linking
- **Incident Correlation** — Group related alerts into incidents
- **Risk Scoring** — Endpoint risk based on alert severity and count
- **IOC Watchlist** — Hash, IP, domain, path indicators
- **Antivirus Module** — File scanning, signatures, heuristics, quarantine

### Dashboard Highlights

- **Process Monitor** — Suspect process detection with suspicious path indicators
- **Process Tree** — Visualize process hierarchy from normalized events
- **Investigations** — Case management with notes and endpoint linking
- **Global Search** — Search across endpoints, alerts, events, hashes
- **AV Dashboard** — Detections, quarantine, policies, signatures, file reputation

---

## 🚀 Quick Start

### 1. Database

```bash
# Using Docker
docker run -d --name edr-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=edr_platform \
  -e MYSQL_USER=edr_user \
  -e MYSQL_PASSWORD=edr_password \
  -p 3306:3306 \
  mysql:8.0

# Apply schema
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/seed.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-phase3.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-phase4.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-phase5.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-phase6.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-endpoint-metrics.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/schema-antivirus.sql
mysql -h 127.0.0.1 -u edr_user -p edr_platform < database/seed-antivirus.sql
```

Or use **Docker Compose**:

```bash
docker-compose up -d mysql
# Wait for MySQL to be ready, then schema/seed are auto-applied
```

### 2. Backend

```bash
cd server-node
cp .env.example .env
# Edit .env: DB_*, JWT_SECRET, AGENT_REGISTRATION_TOKEN

npm install
npm run seed-admin   # Creates admin user: admin / ChangeMe123!
npm start
```

Backend runs on **http://localhost:3001**

### 3. Dashboard

```bash
cd server-node/dashboard
npm install
npm run dev
```

Dashboard runs on **http://localhost:5173**

### 4. Windows Agent

```bash
cd agent-csharp
dotnet build
dotnet run --project src/EDR.Agent.Service -- --console
```

Create `config.json`:

```json
{
  "ServerUrl": "http://localhost:3001",
  "RegistrationToken": "your-token-from-.env",
  "HeartbeatIntervalMinutes": 5,
  "EventBatchIntervalSeconds": 30
}
```

**Install as Windows Service:**

```powershell
# Run as Administrator
.\install-service.ps1
Start-Service EDR.Agent
```

---

## 🏗 Architecture

<div align="center">
  <img src="assets/architecture-diagram.png" alt="Architecture" width="600">
</div>

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│  Windows Agent  │ ──────────────►│  Node.js API   │
│  (C# Service)   │                │  (Express)     │
└─────────────────┘                └────────┬──────┘
        │                                   │
        │ Telemetry                         ▼
        │ - Process events             ┌──────────┐
        │ - Windows Event Log          │  MySQL   │
        │ - Heartbeats                 └──────────┘
        │                                   │
        │ Commands (Phase 2)                 ▼
        │ - Kill process              ┌──────────┐
        │ - Collect triage             │ Dashboard│
        └─────────────────────────────│  (React) │
                                      └──────────┘
```

---

## 📡 API Overview

### Agent API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/agent/register` | Registration token | Register new endpoint |
| POST | `/api/agent/heartbeat` | Agent key | Send heartbeat |
| POST | `/api/agent/events/batch` | Agent key | Upload event batch |
| GET | `/api/agent/actions/pending` | Agent key | Get pending response actions |
| POST | `/api/agent/actions/:id/result` | Agent key | Submit action result |
| GET | `/api/agent/av/policy` | Agent key | Get AV scan policy |
| GET | `/api/agent/av/signatures/download` | Agent key | Download signatures |
| POST | `/api/agent/av/scan-result` | Agent key | Submit scan results |

### Admin API (JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/admin/dashboard/summary` | Dashboard stats |
| GET | `/api/admin/endpoints` | List endpoints |
| GET | `/api/admin/alerts` | List alerts |
| POST | `/api/admin/endpoints/:id/actions` | Create response action |
| GET | `/api/admin/process-monitor` | Process monitor data |
| GET | `/api/admin/av/detections` | AV detections |
| POST | `/api/admin/av/scan-task` | Create scan task |

See [docs/api.md](docs/api.md) for full API reference.

---

## 🛡 Antivirus Module

- **File scanning** — On-demand, scheduled, real-time (FileSystemWatcher)
- **Detection** — Signature (hash, path, binary pattern), heuristics, PE metadata
- **Quarantine** — Move to protected folder, restore/delete workflow
- **Correlation** — Malware alerts → EDR alerts, risk scoring

See [docs/antivirus-setup.md](docs/antivirus-setup.md) and [docs/antivirus-architecture.md](docs/antivirus-architecture.md).

---

## ⚠️ Security Notes

- **Change default admin password** immediately after first login
- Use strong `JWT_SECRET` and `AGENT_REGISTRATION_TOKEN` in production
- Deploy behind HTTPS (reverse proxy)
- Agent runs as LocalSystem by default; consider dedicated service account
- Response actions (e.g. kill process) require trusted server and secure channel

---

## 📄 License

MIT License

---

## 👤 Developer

**Coder-X**

[![GitHub](https://img.shields.io/badge/GitHub-Coder--MoeTain-181717?style=flat&logo=github)](https://github.com/Coder-MoeTain)

---

<div align="center">
  <sub>Built with ❤️ for the security community</sub>
</div>
#   I r o n S h i e l d - E D R  
 