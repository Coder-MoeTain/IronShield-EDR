# Local deployment (development)

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Node.js 20+ (for native dev without Docker)
- MySQL 8 (if not using Docker)

## Quick start (Docker)

```bash
cp .env.example .env
# Edit secrets (JWT_SECRET, MYSQL_*, AGENT_REGISTRATION_TOKEN)

docker compose -f docker-compose.dev.yml up --build
```

Services:

| Service | Port | Notes |
|---------|------|-------|
| API | 3000 | `INGEST_QUEUE_FIRST=true`, Redis worker |
| MySQL | 3306 | Schema from `database/schema.sql` |
| Redis | 6379 | BullMQ ingestion worker |

Run migrations inside backend container:

```bash
docker exec -it edr-backend-dev npm run migrate
docker exec -it edr-backend-dev npm run seed
```

Build dashboard:

```bash
cd server-node && npm run build-dashboard
```

## Native backend

```bash
cd server-node
npm install
npm run migrate
npm run seed
npm run dev
# separate terminal:
npm run worker
```

## Validation

```bash
cd server-node
npm test
npm run detections:validate
npm run detections:test
```
