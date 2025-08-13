import React, { useEffect, useState } from 'react'
import { getVarz, jsInfo } from '../api'

export default function Overview() {
  const [varz, setVarz] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [err, setErr] = useState<string>('')
  const [auto, setAuto] = useState(true)
  const [intervalMs] = useState(5000)

  const loadAll = async () => {
    try {
      const [v, i] = await Promise.all([
        getVarz(),
        jsInfo().catch(() => null),
      ])
      setVarz(v)
      setInfo(i)
      setErr('')
    } catch (e: any) {
      // Clear stale data so user sees immediate change on cluster switch
      setVarz(null)
      setInfo(null)
      setErr(e?.message || 'failed to load')
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
        <h2 className="text-xl font-semibold text-gray-800">Overview</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto refresh (5s)
          </label>
          <button onClick={() => loadAll()} className="button">Refresh</button>
        </div>
      </div>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      <section>
        <h3 className="text-base font-medium text-gray-700 mb-2">Server (varz)</h3>
        {varz ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card title="Server">
              <KV k="ID" v={varz.server_id} />
              <KV k="Version" v={varz.version} />
              <KV k="Go" v={varz.go} />
              <KV k="Host" v={varz.host} />
              <KV k="Ports" v={`client ${varz.port}, http ${varz.http_port}`} />
              <KV k="JetStream" v={String(varz.jetstream)} />
            </Card>
            <Card title="Connections">
              <KV k="Num Conns" v={varz.connections} />
              <KV k="Routes" v={varz.routes} />
              <KV k="Subs" v={varz.subscriptions} />
            </Card>
            <Card title="Memory/CPU">
              <KV k="CPU" v={varz.cpu} />
              <KV k="Mem" v={`${Math.round((varz.mem || 0)/1024/1024)} MB`} />
              <KV k="Cores" v={varz.cores} />
            </Card>
          </div>
        ) : (
          <div className="text-gray-500">Loading varz...</div>
        )}
      </section>

      <section className="mt-4">
        <h3 className="text-base font-medium text-gray-700 mb-2">JetStream Account</h3>
        {info ? (
          <pre className="bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto">{JSON.stringify(info, null, 2)}</pre>
        ) : (
          <div className="text-gray-500">No JetStream account info or not enabled.</div>
        )}
      </section>
    </div>
  )
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="font-semibold text-gray-800 mb-2">{props.title}</div>
      {props.children}
    </div>
  )
}

function KV({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <div className="text-gray-500">{k}</div>
      <div className="font-medium text-gray-800">{String(v)}</div>
    </div>
  )
}

// Tailwind styles used instead of inline styles
