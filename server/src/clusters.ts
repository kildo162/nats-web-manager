import { connect, NatsConnection } from 'nats'

export type ClusterConfig = {
  key: string
  label: string
  natsUrl: string
  monitorUrl?: string
}

// Load clusters from env NATS_CLUSTERS (JSON array) or fallback to single default from NATS_URL/NATS_MONITOR_URL
function loadClusters(): ClusterConfig[] {
  const raw = process.env.NATS_CLUSTERS
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        return arr.map((c, idx) => ({
          key: String(c.key ?? idx === 0 ? 'default' : `c${idx}`),
          label: String(c.label ?? c.key ?? `Cluster ${idx + 1}`),
          natsUrl: String(c.natsUrl ?? c.NATS_URL ?? ''),
          monitorUrl: String(c.monitorUrl ?? c.NATS_MONITOR_URL ?? ''),
        })).filter(c => c.natsUrl)
      }
    } catch {}
  }
  const natsUrl = process.env.NATS_URL || 'nats://127.0.0.1:4222'
  const monitorUrl = process.env.NATS_MONITOR_URL || 'http://127.0.0.1:8222'
  return [{ key: 'default', label: 'Default', natsUrl, monitorUrl }]
}

const clusters = loadClusters()
const connMap = new Map<string, Promise<NatsConnection>>()

export function listClusters(): Omit<ClusterConfig, 'natsUrl'>[] {
  // Do not expose raw natsUrl if you consider it sensitive; keep label and monitorUrl
  return clusters.map(({ key, label, monitorUrl }) => ({ key, label, monitorUrl }))
}

export function getClusterConfig(key?: string): ClusterConfig {
  if (!key) return clusters[0]
  const found = clusters.find(c => c.key === key)
  return found || clusters[0]
}

export async function getNcFor(clusterKey?: string): Promise<NatsConnection> {
  const cfg = getClusterConfig(clusterKey)
  if (!connMap.has(cfg.key)) {
    connMap.set(cfg.key, connect({ servers: cfg.natsUrl }))
  }
  return connMap.get(cfg.key) as Promise<NatsConnection>
}

export function getMonitorBase(clusterKey?: string): string | undefined {
  return getClusterConfig(clusterKey).monitorUrl
}
