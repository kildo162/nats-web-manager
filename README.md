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
 - RTT/latency: `GET /api/rtt` (per selected cluster)

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
# Round-trip latency to NATS
curl http://localhost:4000/api/rtt
# Example: list top pending connections (proxied connz supports sorting/limit)
curl "http://localhost:4000/api/monitor/connz?limit=10&sort=pending&order=-1"
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
# Multiple clusters
- You can configure multiple clusters via `NATS_CLUSTERS` (see `docker-compose.yml`).
- Most endpoints accept a `cluster` query param to select the active cluster, e.g. `GET /api/monitor/varz?cluster=demo` or `GET /api/rtt?cluster=demo`.

## UI Highlights
- Overview
  - RTT latency with recent min/avg/max (computed client-side over last samples)
  - Throughput rates (msgs/s and KB/s) from varz deltas between refreshes
  - Uptime, CPU, memory, and connection counts
- Cluster
  - "Hot Connections" list (top 10 by pending bytes)
  - Raw details for routes, gateways, leafnodes, connections, subscriptions
- JetStream
  - Streams count surfaced in cluster summary
  - Account, cluster, stream, and consumer details
- Controls
  - Auto-refresh (5s) toggle and manual refresh button on Overview/Cluster
# nats-web-manager
