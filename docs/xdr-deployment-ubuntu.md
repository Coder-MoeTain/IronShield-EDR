# IronShield XDR (Kafka) Deployment — Ubuntu

This guide deploys the upgraded EDR → XDR pipeline (Kafka + MySQL + API + workers).

## Services
- **MySQL 8**: storage (legacy tables + `xdr_events`, `xdr_detections`, incident links)
- **Kafka**: telemetry bus (`xdr.raw.*`, `xdr.normalized`)
- **Node API**: `/api/agent/*`, `/api/admin/*`, `/api/ingest/*`, WebSocket `/ws`
- **Workers**
  - `worker:kafka:endpoint-raw` (ingest + normalize into `xdr_events`)
  - `worker:kafka:detections` (rules → `xdr_detections` + alerts)

## 1) Install Docker + Compose
On Ubuntu 22.04+:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 2) Configure environment
Create `.env` in repo root:

```bash
JWT_SECRET="replace-me"
AGENT_REGISTRATION_TOKEN="replace-me"
MYSQL_ROOT_PASSWORD="replace-me"
MYSQL_USER="edr_user"
MYSQL_PASSWORD="replace-me"
XDR_INGEST_KEY="replace-me"
```

## 3) Start stack

```bash
docker compose up -d --build
```

API health:
- `GET http://<server>:3000/health`

## 4) Run migrations (inside backend container)

```bash
docker exec -it edr-backend node scripts/migrate-catch-up.js
docker exec -it edr-backend node scripts/migrate-xdr-events.js
docker exec -it edr-backend node scripts/migrate-xdr-detections.js
docker exec -it edr-backend node scripts/migrate-xdr-incident-links.js
docker exec -it edr-backend node scripts/migrate-xdr-autoresponse.js
```

## 5) Run workers
For production, run workers as separate containers (recommended). For now you can exec them:

```bash
docker exec -it edr-backend npm run worker:kafka:endpoint-raw
docker exec -it edr-backend npm run worker:kafka:detections
```

## 6) External telemetry ingest (Phase 3)
Producers send to:
- `POST /api/ingest/web`
- `POST /api/ingest/auth`
- `POST /api/ingest/zeek`

Header:
- `X-Ingest-Key: <XDR_INGEST_KEY>`

## 7) WebSocket
- `ws://<server>:3000/ws`

## Notes
- Auto-response is **disabled by default**. Enable carefully with:
  - `XDR_AUTORESPONSE_ENABLED=true`
  - `XDR_AUTORESP_ISOLATE=true`
  - `XDR_AUTORESP_BLOCK_IP=true`

