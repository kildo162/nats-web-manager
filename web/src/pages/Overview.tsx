import React, { useEffect, useRef, useState } from 'react'
import AutoRefreshDialog from '../components/AutoRefreshDialog'
import { getRtt, getVarz, jsInfo } from '../api'

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
  const [rttStats, setRttStats] = useState<{ min: number, avg: number, max: number } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false)
  const nextDataRef = useRef<any>(null)
  const [showRefreshDialog, setShowRefreshDialog] = useState(false)

  const fetchAllData = async () => {
    const [v, i, r] = await Promise.all([
      getVarz(),
      jsInfo().catch(() => null),
      getRtt().catch(() => ({ rttMs: null })),
    ])
    const rttVal = r?.rttMs ?? null
    return { v, i, rttVal }
  }

  const applyData = (data: any) => {
    if (!data) return
    const { v, i, rttVal } = data
    setVarz(v)
    setInfo(i)
    setRtt(rttVal)
    // RTT stats
    try {
      if (typeof rttVal === 'number' && isFinite(rttVal)) {
        const hist = rttHistRef.current
        hist.push(rttVal)
        if (hist.length > 12) hist.shift()
        const min = Math.min(...hist)
        const max = Math.max(...hist)
        const avg = hist.reduce((a, b) => a + b, 0) / hist.length
        setRttStats({ min, avg, max })
      }
    } catch {}
    // throughput rates
    try {
      const now = Date.now()
      const pm = Number(v?.in_msgs ?? 0)
      const om = Number(v?.out_msgs ?? 0)
      const pb = Number(v?.in_bytes ?? 0)
      const ob = Number(v?.out_bytes ?? 0)
      const prev = prevRef.current
      if (prev && now > prev.t) {
        const dt = (now - prev.t) / 1000
        const dInM = Math.max(0, pm - prev.in_msgs)
        const dOutM = Math.max(0, om - prev.out_msgs)
        const dInB = Math.max(0, pb - prev.in_bytes)
        const dOutB = Math.max(0, ob - prev.out_bytes)
        setRates({
          inMsgs: dInM / dt,
          outMsgs: dOutM / dt,
          inBytes: dInB / dt,
          outBytes: dOutB / dt,
        })
      }
      prevRef.current = { t: now, in_msgs: pm, out_msgs: om, in_bytes: pb, out_bytes: ob }
    } catch {}
    setLastUpdated(Date.now())
    setHasPendingUpdate(false)
    nextDataRef.current = null
    setErr('')
  }

  const refreshAll = async () => {
    try {
      const data = await fetchAllData()
      applyData(data)
    } catch (e: any) {
      setErr(e?.message || 'failed to load')
    }
  }

  const refreshAllDeferred = async () => {
    try {
      const data = await fetchAllData()
      if (document.hidden) {
        nextDataRef.current = data
        setHasPendingUpdate(true)
      } else {
        applyData(data)
      }
    } catch (e: any) {
      setErr(e?.message || 'failed to load')
    }
  }

  useEffect(() => {
    try { localStorage.setItem('auto_refresh', auto ? '1' : '0') } catch {}
  }, [auto])

  useEffect(() => {
    try { setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs)) } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRefreshDialog])

  useEffect(() => {
    let active = true
    const run = async () => { if (!active) return; await refreshAllDeferred() }
    if (auto) {
      run()
      const t = setInterval(run, intervalMs)
      return () => { active = false; clearInterval(t) }
    }
    return () => { active = false }
  }, [auto, intervalMs])

  // initial load once on mount
  useEffect(() => { refreshAll() }, [])

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && hasPendingUpdate) {
        const data = nextDataRef.current
        if (data) applyData(data)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [hasPendingUpdate])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-800">Overview</h2>
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
      {hasPendingUpdate && (
        <div className="mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-3">
          <span>New data available</span>
          <button className="button" onClick={() => { const d = nextDataRef.current; if (d) applyData(d) }}>Apply updates</button>
        </div>
      )}
      <AutoRefreshDialog open={showRefreshDialog} onClose={() => setShowRefreshDialog(false)} onSaved={() => {
        try { setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs)) } catch {}
      }} />
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
            </Card>
            <Card title="Throughput (avg since last refresh)">
              <KV k="In Msgs/s" v={fmtRate(rates.inMsgs)} />
              <KV k="Out Msgs/s" v={fmtRate(rates.outMsgs)} />
              <KV k="In KB/s" v={fmtRate(rates.inBytes / 1024)} />
              <KV k="Out KB/s" v={fmtRate(rates.outBytes / 1024)} />
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
