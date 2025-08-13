import React, { useEffect, useMemo, useState } from 'react'
import { getConnz, getGatewayz, getLeafz, getRoutez, getSubsz } from '../api'

export default function Cluster() {
  const [routez, setRoutez] = useState<any>(null)
  const [gatewayz, setGatewayz] = useState<any>(null)
  const [leafz, setLeafz] = useState<any>(null)
  const [connz, setConnz] = useState<any>(null)
  const [subsz, setSubsz] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(true)
  const [intervalMs] = useState(5000)
  const [sortKey, setSortKey] = useState<'pending_bytes' | 'in_bytes' | 'out_bytes' | 'in_msgs' | 'out_msgs'>('pending_bytes')
  const [limit, setLimit] = useState<number>(10)

  const hotConns = useMemo(() => {
    try {
      const arr = Array.isArray(connz?.connections) ? (connz.connections as any[]) : []
      return arr
        .slice()
        .sort((a: any, b: any) => Number(b?.[sortKey] || 0) - Number(a?.[sortKey] || 0))
        .slice(0, Math.max(1, Math.min(100, limit || 10)))
    } catch {
      return [] as any[]
    }
  }, [connz, sortKey, limit])

  const loadAll = async () => {
    try {
      setLoading(true)
      const sortParam = sortKey === 'pending_bytes' ? 'pending' : (sortKey as string)
      const [r, g, l, c, s] = await Promise.all([
        getRoutez(),
        getGatewayz(),
        getLeafz(),
        getConnz({ sort: sortParam, order: -1, limit: Math.max(1, Math.min(1000, limit || 10)) }),
        getSubsz({}),
      ])
      setRoutez(r)
      setGatewayz(g)
      setLeafz(l)
      setConnz(c)
      setSubsz(s)
      setErr('')
    } catch (e: any) {
      // Clear stale data so user sees immediate change on cluster switch
      setRoutez(null)
      setGatewayz(null)
      setLeafz(null)
      setConnz(null)
      setSubsz(null)
      setErr(e?.message || 'failed to load cluster info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const run = async () => { if (!active) return; await loadAll() }
    run()
    let t: any
    if (auto) t = setInterval(run, intervalMs)
    return () => { active = false; if (t) clearInterval(t) }
  }, [auto, intervalMs])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-800">Cluster</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto refresh (5s)
          </label>
          <button onClick={() => loadAll()} className="button">Refresh</button>
        </div>
      </div>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {loading ? (
        <div className="text-gray-500">Loading cluster info...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="Routes">
            <div className="mb-2">Total: {routez?.num_routes ?? (routez?.routes?.length || 0)}</div>
            <SummaryList items={routez?.routes || []} label={(r: any) => `${r.remote_id} @ ${r.ip}:${r.port}`} />
            <Pre obj={routez} />
          </Section>
          <Section title="Gateways">
            <div className="mb-2">Inbound: {gatewayz?.num_inbound ?? (gatewayz?.inbound?.length || 0)}, Outbound: {gatewayz?.num_outbound ?? (gatewayz?.outbound?.length || 0)}</div>
            <Pre obj={gatewayz} />
          </Section>
          <Section title="Leafnodes">
            <div className="mb-2">Total: {leafz?.num_leafnodes ?? (leafz?.leafnodes?.length || 0)}</div>
            <Pre obj={leafz} />
          </Section>
          <Section title="Connections">
            <div className="mb-2">Total: {connz?.total || 0}</div>
            <Pre obj={connz} />
          </Section>
          <Section title="Hot Connections (by pending bytes)">
            <div className="flex items-center gap-3 mb-2 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Sort</span>
                <select className="input" value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
                  <option value="pending_bytes">pending_bytes</option>
                  <option value="in_msgs">in_msgs</option>
                  <option value="out_msgs">out_msgs</option>
                  <option value="in_bytes">in_bytes</option>
                  <option value="out_bytes">out_bytes</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Limit</span>
                <input className="input w-20" type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
              </label>
            </div>
            <SummaryList
              items={hotConns}
              label={(c: any) => formatConnSummary(c, sortKey)}
            />
          </Section>
          <Section title="Subscriptions">
            <div className="mb-2">Total: {subsz?.num_subscriptions || 0}</div>
            <Pre obj={subsz} />
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function Pre({ obj }: { obj: any }) {
  if (!obj) return null
  return <pre className="bg-gray-900 text-gray-100 text-sm rounded-lg p-3 overflow-auto">{JSON.stringify(obj, null, 2)}</pre>
}

function SummaryList({ items, label }: { items: any[], label: (x: any) => string }) {
  if (!items?.length) return <div className="text-gray-500">None</div>
  return (
    <ul className="list-disc pl-5 my-2 space-y-1">
      {items.map((it, idx) => (
        <li key={idx} className="text-sm text-gray-800">{label(it)}</li>
      ))}
    </ul>
  )
}

// Tailwind styles used instead of inline styles

function fmtBytes(n: number | undefined | null) {
  const v = Number(n || 0)
  if (!isFinite(v) || v <= 0) return '0 B'
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  if (v < 1024 * 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`
  return `${(v / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatConnSummary(c: any, sortKey: string) {
  const id = `#${c?.cid ?? '?'}`
  const where = `${(c?.name || c?.ip || '-')}:${c?.port ?? ''}`
  const pending = `pending=${fmtBytes(c?.pending_bytes)}`
  const msgs = `msgs[in=${c?.in_msgs ?? 0}, out=${c?.out_msgs ?? 0}]`
  const bytes = `bytes[in=${fmtBytes(c?.in_bytes)}, out=${fmtBytes(c?.out_bytes)}]`
  const subs = `subs=${c?.subscriptions ?? 0}`
  const sortVal = `${sortKey}=${sortKey.includes('bytes') ? fmtBytes(c?.[sortKey]) : String(c?.[sortKey] ?? 0)}`
  return `${id} ${where} ${pending} ${msgs} ${bytes} ${subs} (${sortVal})`
}
