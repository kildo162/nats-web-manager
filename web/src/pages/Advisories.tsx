import React, { useEffect, useMemo, useRef, useState } from 'react'
import { subscribe } from '../api'

// Lightweight viewer for NATS $SYS.> and $JS.EVENT.>
// Uses existing SSE endpoint /api/subscribe via subscribe() helper
// Shows recent events with filtering and pause/resume controls

export default function Advisories() {
  const [running, setRunning] = useState(true)
  const [events, setEvents] = useState<Array<{ time: number; subject: string; data: any }>>([])
  const [filter, setFilter] = useState('')
  const [maxRows, setMaxRows] = useState(200)
  const unsubRef = useRef<null | (() => void)>(null)
  const [err, setErr] = useState('')

  const start = () => {
    stop()
    try {
      const off1 = subscribe('$SYS.>', onEvt)
      const off2 = subscribe('$JS.EVENT.>', onEvt)
      unsubRef.current = () => { try { off1() } catch {}; try { off2() } catch {} }
      setErr('')
    } catch (e: any) {
      setErr(e?.message || 'subscribe error')
    }
  }

  const stop = () => {
    try { unsubRef.current?.() } catch {}
    unsubRef.current = null
  }

  const onEvt = (msg: any) => {
    if (!msg || !msg.subject) return
    setEvents((prev) => {
      const next = [
        { time: Date.now(), subject: String(msg.subject), data: msg.data },
        ...prev,
      ]
      if (next.length > Math.max(50, Math.min(2000, maxRows))) next.length = maxRows
      return next
    })
  }

  useEffect(() => {
    if (running) start()
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) => e.subject.toLowerCase().includes(q) || JSON.stringify(e.data).toLowerCase().includes(q))
  }, [events, filter])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-800">Advisories / Events</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={running} onChange={(e) => setRunning(e.target.checked)} />
            Live (SSE)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>Max rows</span>
            <input className="input w-24" type="number" min={50} max={2000} value={maxRows} onChange={(e) => setMaxRows(Number(e.target.value || 200))} />
          </label>
          <button className="button" onClick={() => setEvents([])}>Clear</button>
        </div>
      </div>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}

      <div className="card overflow-hidden">
        <div className="px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800 flex items-center gap-3">
          <div>Events</div>
          <input
            className="input flex-1"
            placeholder="Filter by subject or payload..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="text-sm text-gray-500">{filtered.length} / {events.length}</div>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Subject</th>
                <th className="text-left px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="align-top px-3 py-2 whitespace-nowrap text-gray-700">{fmtTime(e.time)}</td>
                  <td className="align-top px-3 py-2 font-mono text-gray-800">{e.subject}</td>
                  <td className="align-top px-3 py-2">
                    <pre className="bg-gray-900 text-gray-100 text-xs rounded-md p-2 overflow-auto max-w-[70vw]">{fmtJson(e.data)}</pre>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-500">No events</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function fmtJson(v: any) {
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function fmtTime(t: number) {
  try { return new Date(t).toLocaleTimeString() } catch { return String(t) }
}
