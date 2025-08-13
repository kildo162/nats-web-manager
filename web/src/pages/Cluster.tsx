import React, { useEffect, useState } from 'react'
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

  const loadAll = async () => {
    try {
      setLoading(true)
      const [r, g, l, c, s] = await Promise.all([
        getRoutez(),
        getGatewayz(),
        getLeafz(),
        getConnz({}),
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
            <SummaryList items={routez?.routes || []} label={(r: any) => `${r.remote_id} @ ${r.ip}:${r.port}`} />
            <Pre obj={routez} />
          </Section>
          <Section title="Gateways">
            <Pre obj={gatewayz} />
          </Section>
          <Section title="Leafnodes">
            <Pre obj={leafz} />
          </Section>
          <Section title="Connections">
            <div className="mb-2">Total: {connz?.total || 0}</div>
            <Pre obj={connz} />
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
