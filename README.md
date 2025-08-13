# NATS Web Manager (Backend MVP)

Backend API to manage/monitor NATS.

## Features
- Proxy NATS monitoring endpoints: `/api/monitor/{varz|connz|routez|gatewayz|leafz|subsz|accountz|accstatz|jsz|healthz}`
- Publish: `POST /api/publish` { subject, data }
- Subscribe via SSE: `GET /api/subscribe?subject=foo` (Server-Sent Events)
- JetStream (read-only):
  - `/api/js/info`
  - `/api/js/streams`, `/api/js/streams/:name`
  - `/api/js/consumers/:stream`, `/api/js/consumers/:stream/:name`

## Run with Docker Compose (recommended)
```bash
cd nats-web-manager
docker compose up
```
Services:
- NATS at `nats://localhost:4222` with JetStream and monitor port 8222
- API at `http://localhost:4000`

Test:
```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/monitor/varz
```

## Run locally (without Docker)
```bash
cd server
npm install
# set env vars to your NATS
export NATS_URL=nats://127.0.0.1:4222
export NATS_MONITOR_URL=http://127.0.0.1:8222
npm run dev
```

## Notes
- Do not expose NATS monitor (8222) publicly. The API proxies it instead.
- For production, add authentication/RBAC, rate limiting, and HTTPS.
# nats-web-manager
