import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AutoRefreshDialog from '../components/AutoRefreshDialog'
import { getRtt, getVarz, jsInfo } from '../api'
import MiniLineChart from '../components/MiniLineChart'

export default function Overview() {
  const [varz, setVarz] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [rtt, setRtt] = useState<number | null>(null)
  const [err, setErr] = useState<string>('')
  const [auto, setAuto] = useState<boolean>(() => {
    try { return localStorage.getItem('auto_refresh') === '1' } catch { return false }
  })
  const [intervalMs, setIntervalMs] = useState<number>(() => {
    try { return Number(localStorage.getItem('refresh_interval_ms') || 5000) } catch { return 5000 }
  })
  const prevRef = useRef<{ t: number, in_msgs: number, out_msgs: number, in_bytes: number, out_bytes: number } | null>(null)
  const [rates, setRates] = useState<{ inMsgs: number, outMsgs: number, inBytes: number, outBytes: number }>({ inMsgs: 0, outMsgs: 0, inBytes: 0, outBytes: 0 })
  const rttHistRef = useRef<number[]>([])
  const inMsgsHistRef = useRef<number[]>([])
  const outMsgsHistRef = useRef<number[]>([])
  const inBytesHistRef = useRef<number[]>([])
  const outBytesHistRef = useRef<number[]>([])
  const [rttStats, setRttStats] = useState<{ min: number, avg: number, max: number } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  // errors surfaced via query error states
  const [showRefreshDialog, setShowRefreshDialog] = useState(false)

  // React Query data fetching with polling controlled by UI state
  const varzQuery = useQuery({
    queryKey: ['varz'],
    queryFn: async () => await getVarz(),
    refetchInterval: auto ? intervalMs : false,
  })
  const jsInfoQuery = useQuery({
    queryKey: ['jsInfo'],
    queryFn: async () => await jsInfo().catch(() => null),
    refetchInterval: auto ? Math.max(2 * intervalMs, 10_000) : false,
  })
  const rttQuery = useQuery({
    queryKey: ['rtt'],
    queryFn: async () => await getRtt().catch(() => ({ rttMs: null })),
    refetchInterval: auto ? intervalMs : false,
  })

  // When queries change, update local derived states
  useEffect(() => {
    if (varzQuery.data) {
      setVarz(varzQuery.data as any)
      try {
        const now = Date.now()
        const pm = Number((varzQuery.data as any)?.in_msgs ?? 0)
        const om = Number((varzQuery.data as any)?.out_msgs ?? 0)
        const pb = Number((varzQuery.data as any)?.in_bytes ?? 0)
        const ob = Number((varzQuery.data as any)?.out_bytes ?? 0)
        const prev = prevRef.current
        if (prev && now > prev.t) {
          const dt = (now - prev.t) / 1000
          const dInM = Math.max(0, pm - prev.in_msgs)
          const dOutM = Math.max(0, om - prev.out_msgs)
          const dInB = Math.max(0, pb - prev.in_bytes)
          const dOutB = Math.max(0, ob - prev.out_bytes)
          setRates({ inMsgs: dInM / dt, outMsgs: dOutM / dt, inBytes: dInB / dt, outBytes: dOutB / dt })
          // update histories (cap ~60 points)
          pushCap(inMsgsHistRef.current, dInM / dt, 60)
          pushCap(outMsgsHistRef.current, dOutM / dt, 60)
          pushCap(inBytesHistRef.current, dInB / dt, 60)
          pushCap(outBytesHistRef.current, dOutB / dt, 60)
        }
        prevRef.current = { t: now, in_msgs: pm, out_msgs: om, in_bytes: pb, out_bytes: ob }
      } catch {}
      setLastUpdated(Date.now())
    }
  }, [varzQuery.data])

  useEffect(() => {
    if (jsInfoQuery.data !== undefined) {
      setInfo(jsInfoQuery.data)
      setLastUpdated(Date.now())
    }
  }, [jsInfoQuery.data])

  useEffect(() => {
    const rttVal = (rttQuery.data as any)?.rttMs ?? null
    setRtt(rttVal)
    if (typeof rttVal === 'number' && isFinite(rttVal)) {
      try {
        const hist = rttHistRef.current
        hist.push(rttVal)
        if (hist.length > 12) hist.shift()
        const min = Math.min(...hist)
        const max = Math.max(...hist)
        const avg = hist.reduce((a, b) => a + b, 0) / hist.length
        setRttStats({ min, avg, max })
      } catch {}
    }
    if (rttQuery.data) setLastUpdated(Date.now())
  }, [rttQuery.data])

  const refreshAll = async () => {
    try {
      await Promise.all([varzQuery.refetch(), jsInfoQuery.refetch(), rttQuery.refetch()])
      setErr('')
    } catch (e: any) {
      setErr(e?.message || 'failed to load')
    }
  }

  // no deferred refresh needed as React Query pauses on hidden by default

  useEffect(() => {
    try { localStorage.setItem('auto_refresh', auto ? '1' : '0') } catch {}
  }, [auto])

  useEffect(() => {
    try { setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs)) } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRefreshDialog])

  // React Query handles polling; no manual intervals needed

  // initial manual kick (optional)
  useEffect(() => { refreshAll() }, [])

  // React Query already supports focus/visibility behaviors

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Overview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Live status and key metrics for the selected cluster.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {`Auto refresh (${Math.max(1, Math.round(intervalMs/1000))}s)`}
          </label>
          <button onClick={() => refreshAll()} className="button">Refresh</button>
          <button onClick={() => setShowRefreshDialog(true)} className="button">Settings</button>
          <div className="ml-2 text-xs text-gray-500">
            {lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'No updates yet'}
          </div>
        </div>
      </div>
      {/* Live updates handled by React Query */}
      <AutoRefreshDialog open={showRefreshDialog} onClose={() => setShowRefreshDialog(false)} onSaved={() => {
        try { setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs)) } catch {}
      }} />
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {(varzQuery.error || jsInfoQuery.error || rttQuery.error) && (
        <div className="text-red-600 text-sm mb-2">Failed to fetch some data.</div>
      )}

      {/* Key Metrics */}
      <section aria-label="Key metrics" className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Active Conns</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{varz?.connections ?? '-'}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">RTT</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{rtt == null ? '-' : fmtMs(rtt)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">In Msgs/s</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{fmtRate(rates.inMsgs)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Out Msgs/s</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{fmtRate(rates.outMsgs)}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Memory</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{`${Math.round((varz?.mem || 0)/1024/1024)} MB`}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">CPU</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{varz?.cpu ?? '-'}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Subscriptions</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{varz?.subscriptions ?? '-'}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Routes</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{varz?.routes ?? '-'}</div>
          </div>
        </div>
      </section>
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
              <KV k="Uptime" v={varz.uptime || '-'} />
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
            <Card title="Health/Alerts">
              <KV k="Slow Consumers" v={varz?.slow_consumers ?? 0} />
              <KV k="Max Payload" v={fmtBytes(varz?.max_payload)} />
              <KV k="Max Conns" v={varz?.max_connections ?? '-'} />
              <KV k="Write Deadline" v={
                typeof varz?.write_deadline === 'number' ? `${varz.write_deadline}s` : (varz?.write_deadline || '-')
              } />
            </Card>
            <Card title="Latency">
              <KV k="RTT" v={rtt == null ? '-' : fmtMs(rtt)} />
              {rttStats && (
                <>
                  <KV k="RTT Min" v={fmtMs(rttStats.min)} />
                  <KV k="RTT Avg" v={fmtMs(rttStats.avg)} />
                  <KV k="RTT Max" v={fmtMs(rttStats.max)} />
                </>
              )}
              <div className="mt-2">
                <MiniLineChart data={rttHistRef.current.slice()} color="#22c55e" height={64} format={fmtMsShort} />
              </div>
            </Card>
            <Card title="Throughput (live)">
              <KV k="In Msgs/s" v={fmtRate(rates.inMsgs)} />
              <KV k="Out Msgs/s" v={fmtRate(rates.outMsgs)} />
              <div className="mt-2">
                <MiniLineChart data={inMsgsHistRef.current.slice()} color="#3b82f6" height={48} format={(v) => `${fmtRate(v)} msg/s`} />
              </div>
              <div className="mt-2">
                <MiniLineChart data={outMsgsHistRef.current.slice()} color="#a855f7" height={48} format={(v) => `${fmtRate(v)} msg/s`} />
              </div>
              <KV k="In KB/s" v={fmtRate(rates.inBytes / 1024)} />
              <KV k="Out KB/s" v={fmtRate(rates.outBytes / 1024)} />
              <div className="mt-2">
                <MiniLineChart data={inBytesHistRef.current.slice()} color="#06b6d4" height={48} format={(v) => `${fmtRate(v/1024)} KB/s`} />
              </div>
              <div className="mt-2">
                <MiniLineChart data={outBytesHistRef.current.slice()} color="#f59e0b" height={48} format={(v) => `${fmtRate(v/1024)} KB/s`} />
              </div>
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

function fmtRate(n: number) {
  if (!isFinite(n) || n <= 0) return '0'
  if (n >= 1000) return n.toFixed(0)
  if (n >= 100) return n.toFixed(1)
  return n.toFixed(2)
}

function fmtMs(n: number) {
  if (!isFinite(n) || n < 0) return '-'
  if (n < 1) return `${n.toFixed(2)} ms`
  if (n < 10) return `${n.toFixed(1)} ms`
  return `${Math.round(n)} ms`
}

function fmtBytes(x: any) {
  const n = Number(x || 0)
  if (!isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function pushCap(arr: number[], v: number, cap = 60) {
  arr.push(v)
  if (arr.length > cap) arr.splice(0, arr.length - cap)
}

function fmtMsShort(n: number) {
  if (!isFinite(n) || n < 0) return '-'
  if (n < 1) return `${n.toFixed(2)}ms`
  if (n < 10) return `${n.toFixed(1)}ms`
  return `${Math.round(n)}ms`
}
