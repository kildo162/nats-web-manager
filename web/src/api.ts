const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'

let CLUSTER: string | undefined
export function setCluster(key?: string) {
  CLUSTER = key || undefined
  try { console.debug('[api] setCluster ->', CLUSTER) } catch {}
}

export async function getClusters() {
  const r = await fetch(`${API_BASE}/api/clusters`)
  if (!r.ok) throw new Error(`clusters ${r.status}`)
  return r.json()
}

export async function getClusterStatuses() {
  const r = await fetch(`${API_BASE}/api/clusters/status`)
  if (!r.ok) throw new Error(`cluster status ${r.status}`)
  return r.json()
}

function qsWithCluster(params: Record<string, any> = {}) {
  const merged: Record<string, any> = { ...params }
  if (CLUSTER) merged.cluster = CLUSTER
  const qs = new URLSearchParams(merged as any).toString()
  try { console.debug('[api] qsWithCluster', { CLUSTER, merged, qs }) } catch {}
  return qs ? `?${qs}` : ''
}

export async function getRtt() {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/rtt${qs}`)
  if (!r.ok) throw new Error(`rtt ${r.status}`)
  return r.json()
}

export async function getVarz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/varz${qs}`)
  if (!r.ok) throw new Error(`varz ${r.status}`)
  return r.json()
}

export async function getConnz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/connz${qs}`)
  if (!r.ok) throw new Error(`connz ${r.status}`)
  return r.json()
}

export async function jsInfo() {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/info${qs}`)
  if (!r.ok) throw new Error(`js/info ${r.status}`)
  return r.json()
}

export async function jsStreams() {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/streams${qs}`)
  if (!r.ok) throw new Error(`js/streams ${r.status}`)
  return r.json()
}

export async function jsStreamInfo(name: string) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/streams/${encodeURIComponent(name)}${qs}`)
  if (!r.ok) throw new Error(`js/streams/${name} ${r.status}`)
  return r.json()
}

export async function jsConsumers(stream: string) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}${qs}`)
  if (!r.ok) throw new Error(`js/consumers/${stream} ${r.status}`)
  return r.json()
}

export async function jsConsumerInfo(stream: string, name: string) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}/${encodeURIComponent(name)}${qs}`)
  if (!r.ok) throw new Error(`js/consumers/${stream}/${name} ${r.status}`)
  return r.json()
}

// JetStream message browsing and management
export type JsMessageParams = {
  seq?: number
  last_by_subj?: string
  next_by_subj?: string
  from?: number
}

export async function jsGetMessage(stream: string, params: JsMessageParams) {
  const qs = qsWithCluster(params as any)
  const r = await fetch(`${API_BASE}/api/js/streams/${encodeURIComponent(stream)}/message${qs}`)
  if (!r.ok) throw new Error(`js/streams/${stream}/message ${r.status}`)
  return r.json()
}

export async function jsStreamPurge(stream: string, opts: Record<string, any> = {}) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/streams/${encodeURIComponent(stream)}/purge${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts || {}),
  })
  if (!r.ok) throw new Error(`js/streams/${stream}/purge ${r.status}`)
  return r.json()
}

export async function jsStreamDelete(stream: string) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/streams/${encodeURIComponent(stream)}${qs}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`js/streams/${stream} ${r.status}`)
  return r.json()
}

export async function jsConsumerDelete(stream: string, name: string) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}/${encodeURIComponent(name)}${qs}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`js/consumers/${stream}/${name} ${r.status}`)
  return r.json()
}

// Streams: create & update
export async function jsStreamCreate(cfg: Record<string, any>) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/streams${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg || {}),
  })
  if (!r.ok) throw new Error(`js/streams create ${r.status}`)
  return r.json()
}

export async function jsStreamUpdate(name: string, cfg: Record<string, any>) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/streams/${encodeURIComponent(name)}${qs}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg || {}),
  })
  if (!r.ok) throw new Error(`js/streams update ${name} ${r.status}`)
  return r.json()
}

// Consumers: create & update
export async function jsConsumerCreate(stream: string, cfg: Record<string, any>) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg || {}),
  })
  if (!r.ok) throw new Error(`js/consumers create ${stream} ${r.status}`)
  return r.json()
}

export async function jsConsumerUpdate(stream: string, name: string, cfg: Record<string, any>) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/js/consumers/${encodeURIComponent(stream)}/${encodeURIComponent(name)}${qs}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg || {}),
  })
  if (!r.ok) throw new Error(`js/consumers update ${stream}/${name} ${r.status}`)
  return r.json()
}

export async function publish(subject: string, data: any) {
  const qs = qsWithCluster()
  const r = await fetch(`${API_BASE}/api/publish${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, data })
  })
  if (!r.ok) throw new Error(`publish ${r.status}`)
  return r.json()
}

export function subscribe(subject: string, onMessage: (evt: any) => void): () => void {
  const baseParams: Record<string, any> = { subject }
  const qs = qsWithCluster(baseParams)
  const url = `${API_BASE}/api/subscribe${qs}`
  const ev = new EventSource(url)
  const handler = (e: MessageEvent) => {
    try {
      const obj = JSON.parse(e.data)
      onMessage(obj)
    } catch (err) {
      // ignore
    }
  }
  ev.addEventListener('message', handler)
  ev.onerror = () => {
    // auto-close on error
    ev.close()
  }
  return () => ev.close()
}

// Cluster and additional monitoring endpoints
export async function getRoutez(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/routez${qs}`)
  if (!r.ok) throw new Error(`routez ${r.status}`)
  return r.json()
}

export async function getGatewayz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/gatewayz${qs}`)
  if (!r.ok) throw new Error(`gatewayz ${r.status}`)
  return r.json()
}

export async function getLeafz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/leafz${qs}`)
  if (!r.ok) throw new Error(`leafz ${r.status}`)
  return r.json()
}

export async function getSubsz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/subsz${qs}`)
  if (!r.ok) throw new Error(`subsz ${r.status}`)
  return r.json()
}

export async function getAccountz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/accountz${qs}`)
  if (!r.ok) throw new Error(`accountz ${r.status}`)
  return r.json()
}

export async function getAccstatz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/accstatz${qs}`)
  if (!r.ok) throw new Error(`accstatz ${r.status}`)
  return r.json()
}

export async function getJsz(params: Record<string, any> = {}) {
  const qs = qsWithCluster(params)
  const r = await fetch(`${API_BASE}/api/monitor/jsz${qs}`)
  if (!r.ok) throw new Error(`jsz ${r.status}`)
  return r.json()
}
