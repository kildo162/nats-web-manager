import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { JSONCodec, NatsConnection, Subscription } from 'nats';
import { getMonitorBase, getNcFor, listClusters } from './clusters';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 4000);
// Connections and monitor base are now resolved per-cluster via clusters.ts

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
    const r = await axios.get(`${base}/${z}`, { params });
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`NATS Web Manager API listening on :${PORT}`);
});
