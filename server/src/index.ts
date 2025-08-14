import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { JSONCodec, NatsConnection, Subscription } from 'nats';
import { getMonitorBase, getNcFor, listClusters } from './clusters';
import client from 'prom-client';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 4000);
// Connections and monitor base are now resolved per-cluster via clusters.ts

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const natsRttMs = new client.Histogram({
  name: 'nwm_nats_rtt_ms',
  help: 'NATS RTT in milliseconds',
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000],
  registers: [register],
});

const publishCounter = new client.Counter({
  name: 'nwm_publish_total',
  help: 'Total number of published messages',
  labelNames: ['subject'],
  registers: [register],
});

const subscribeCounter = new client.Counter({
  name: 'nwm_subscribe_requests_total',
  help: 'Total number of subscribe requests (SSE)',
  registers: [register],
});

const monitorProxyDuration = new client.Histogram({
  name: 'nwm_monitor_proxy_duration_seconds',
  help: 'Duration of proxied NATS monitor calls',
  labelNames: ['z'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// lightweight metrics middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const dur = Number(process.hrtime.bigint() - start) / 1e9;
      const path = req.path || 'unknown';
      httpRequestDuration.labels(req.method, path, String(res.statusCode)).observe(dur);
    } catch {}
  });
  next();
});

// Expose /metrics
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Round-trip time to NATS for quick latency insight
app.get('/api/rtt', async (req, res) => {
  try {
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const rtt = await nc.rtt();
    res.json({ rttMs: rtt });
    try { if (typeof rtt === 'number' && isFinite(rtt)) natsRttMs.observe(rtt); } catch {}
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'rtt error' });
  }
});

// List configured clusters (labels and monitor URLs)
app.get('/api/clusters', (_req, res) => {
  res.json(listClusters());
});

const allowedZ = new Set([
  'varz',
  'connz',
  'routez',
  'gatewayz',
  'leafz',
  'subsz',
  'accountz',
  'accstatz',
  'jsz',
  'healthz',
]);

app.get('/api/monitor/:z', async (req, res) => {
  try {
    const { z } = req.params as { z: string };
    if (!allowedZ.has(z)) {
      return res.status(404).json({ error: 'unknown endpoint' });
    }
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const base = getMonitorBase(clusterKey);
    if (!base) {
      return res.status(501).json({ error: 'monitoring not configured for this cluster' });
    }
    const params = { ...req.query } as any;
    delete params.cluster;
    const t0 = process.hrtime.bigint();
    const r = await axios.get(`${base}/${z}`, { params });
    try {
      const dt = Number(process.hrtime.bigint() - t0) / 1e9;
      monitorProxyDuration.labels(z).observe(dt);
    } catch {}
    res.status(r.status).json(r.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'monitoring proxy error' });
  }
});

app.post('/api/publish', async (req, res) => {
  try {
    const { subject, data } = req.body || {};
    if (!subject) return res.status(400).json({ error: 'subject required' });
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jc = JSONCodec();
    const payload = typeof data === 'string' ? data : data !== undefined ? data : {};
    nc.publish(subject, jc.encode(payload));
    res.json({ ok: true });
    try { publishCounter.labels(String(subject)).inc(); } catch {}
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'publish error' });
  }
});

app.get('/api/subscribe', async (req, res) => {
  const subject = String(req.query.subject || '');
  if (!subject) return res.status(400).json({ error: 'subject query required' });
  try {
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jc = JSONCodec();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // flush headers if available (Node's ServerResponse)
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const sub: Subscription = nc.subscribe(subject);
    let closed = false;
    try { subscribeCounter.inc(); } catch {}

    (async () => {
      for await (const m of sub) {
        if (closed) break;
        try {
          let data: any = null;
          try { data = jc.decode(m.data); } catch { data = new TextDecoder().decode(m.data as Uint8Array); }
          res.write(`data: ${JSON.stringify({ subject: m.subject, data, time: Date.now() })}\n\n`);
        } catch {}
      }
      res.end();
    })();

    req.on('close', () => {
      closed = true;
      try { sub.unsubscribe(); } catch {}
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'subscribe error' });
  }
});

// Helper to collect async iterators
async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

// JetStream: info
app.get('/api/js/info', async (req, res) => {
  try {
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc: NatsConnection = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const info = await jsm.getAccountInfo();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'js info error' });
  }
});

// JetStream: list streams
app.get('/api/js/streams', async (req, res) => {
  try {
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const lister = await jsm.streams.list();
    const items: any[] = [];
    for await (const s of lister) items.push(s);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'list streams error' });
  }
});

// JetStream: stream info
app.get('/api/js/streams/:name', async (req, res) => {
  try {
    const { name } = req.params as { name: string };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const info = await jsm.streams.info(name);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'stream info error' });
  }
});

// JetStream: list consumers of a stream
app.get('/api/js/consumers/:stream', async (req, res) => {
  try {
    const { stream } = req.params as { stream: string };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const consumers = await collect(jsm.consumers.list(stream));
    res.json(consumers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'list consumers error' });
  }
});

// JetStream: consumer info
app.get('/api/js/consumers/:stream/:name', async (req, res) => {
  try {
    const { stream, name } = req.params as { stream: string; name: string };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const info = await jsm.consumers.info(stream, name);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'consumer info error' });
  }
});

// Feature-gated JetStream management (Phase C)
const ENABLE_JS_MANAGEMENT = process.env.ENABLE_JS_MANAGEMENT === '1';

function guardMgmt(res: express.Response): boolean {
  if (!ENABLE_JS_MANAGEMENT) {
    res.status(403).json({ error: 'JetStream management disabled. Set ENABLE_JS_MANAGEMENT=1 to enable.' });
    return false;
  }
  return true;
}

// Streams: create
app.post('/api/js/streams', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const cfg = req.body || {};
    if (!cfg || !cfg.name) return res.status(400).json({ error: 'stream config with name required' });
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc: NatsConnection = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const r = await jsm.streams.add(cfg);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'create stream error' });
  }
});

// Streams: update
app.put('/api/js/streams/:name', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const { name } = req.params as { name: string };
    const cfg = { ...(req.body || {}), name };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const r = await jsm.streams.update(name, cfg);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'update stream error' });
  }
});

// Streams: delete
app.delete('/api/js/streams/:name', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const { name } = req.params as { name: string };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    await jsm.streams.delete(name);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'delete stream error' });
  }
});

// Streams: purge
app.post('/api/js/streams/:name/purge', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const { name } = req.params as { name: string };
    const opts = req.body || {};
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const r = await jsm.streams.purge(name, opts);
    res.json(r ?? { ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'purge stream error' });
  }
});

// Consumers: create
app.post('/api/js/consumers/:stream', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const { stream } = req.params as { stream: string };
    const cfg = req.body || {};
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const r = await jsm.consumers.add(stream, cfg);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'create consumer error' });
  }
});

// Consumers: update
app.put('/api/js/consumers/:stream/:name', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const { stream, name } = req.params as { stream: string; name: string };
    const cfg = { ...(req.body || {}), durable_name: req.body?.durable_name ?? name };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    const r = await jsm.consumers.update(stream, name, cfg);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'update consumer error' });
  }
});

// Consumers: delete
app.delete('/api/js/consumers/:stream/:name', async (req, res) => {
  if (!guardMgmt(res)) return;
  try {
    const { stream, name } = req.params as { stream: string; name: string };
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();
    await jsm.consumers.delete(stream, name);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'delete consumer error' });
  }
});

// JetStream: get stored message (read-only browsing)
app.get('/api/js/streams/:name/message', async (req, res) => {
  try {
    const { name } = req.params as { name: string };
    const { seq, last_by_subj, next_by_subj, from } = req.query as any;
    const clusterKey = typeof req.query.cluster === 'string' ? String(req.query.cluster) : undefined;
    const nc: NatsConnection = await getNcFor(clusterKey);
    const jsm = await nc.jetstreamManager();

    const opts: any = {};
    if (seq !== undefined) {
      const n = Number(seq);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'invalid seq' });
      opts.seq = n;
    } else if (last_by_subj) {
      opts.last_by_subj = String(last_by_subj);
    } else if (next_by_subj) {
      opts.next_by_subj = String(next_by_subj);
      const f = Number(from);
      if (Number.isFinite(f) && f > 0) opts.seq = f;
    } else {
      return res.status(400).json({ error: 'must specify seq, last_by_subj or next_by_subj' });
    }

    const sm = await jsm.streams.getMessage(name, opts);
    const hdrs = (sm as any).header || (sm as any).headers || undefined;
    const data = (sm as any).data as Uint8Array | undefined;
    const meta = {
      seq: (sm as any).seq,
      subject: (sm as any).subject,
      time: (sm as any).time,
      size: Array.isArray(data) ? (data as any).length : (data ? (data as Uint8Array).byteLength : 0),
    };
    let text: string | undefined = undefined;
    let json: any = null;
    let base64: string | undefined = undefined;
    try {
      if (data) {
        const buf = Buffer.from(data as Uint8Array);
        base64 = buf.toString('base64');
        try { text = new TextDecoder().decode(data); } catch {}
        if (text && text.length && text.length < 2_000_000) {
          try { json = JSON.parse(text); } catch { json = null; }
        }
      }
    } catch {}

    res.json({ meta, headers: hdrs, data: { text, base64 }, json });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'get message error' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`NATS Web Manager API listening on :${PORT}`);
});
