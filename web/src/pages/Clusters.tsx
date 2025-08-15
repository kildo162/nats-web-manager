import React, { useEffect, useMemo, useState } from 'react'
import { getClusters, getClusterStatuses } from '../api'

export default function Clusters() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [clusters, setClusters] = useState<Array<{ key: string; label: string; monitorUrl?: string }>>([])
  const [status, setStatus] = useState<Record<string, { natsOk: boolean; monitorOk: boolean }>>({})
  const [q, setQ] = useState('')

  // load clusters
  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const list = await getClusters()
        if (!alive) return
        // ensure unique by key
        const uniqMap = new Map<string, { key: string; label: string; monitorUrl?: string }>()
        for (const c of list) if (!uniqMap.has(c.key)) uniqMap.set(c.key, c)
        setClusters(Array.from(uniqMap.values()))
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || 'Failed to load clusters')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    const t = setInterval(load, 60000) // refresh list every 60s
    return () => { alive = false; clearInterval(t) }
  }, [])

  // poll statuses
  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const list: Array<{ key: string; natsOk: boolean; monitorOk: boolean }> = await getClusterStatuses()
        if (!alive) return
        const map: Record<string, { natsOk: boolean; monitorOk: boolean }> = {}
        for (const s of list) map[s.key] = { natsOk: !!s.natsOk, monitorOk: !!s.monitorOk }
        setStatus(map)
      } catch {}
    }
    poll()
    const t = setInterval(poll, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return clusters
    return clusters.filter(c =>
      c.label.toLowerCase().includes(query) ||
      c.key.toLowerCase().includes(query) ||
      (c.monitorUrl ? c.monitorUrl.toLowerCase().includes(query) : false)
    )
  }, [q, clusters])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Clusters</h2>
          <p className="text-sm text-gray-500">Danh sách các cụm NATS và tình trạng kết nối (NATS/Monitor)</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, key, hoặc monitor URL"
            className="w-72 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            className="rounded-md bg-indigo-600 text-white text-sm px-3 py-2 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={() => { setQ(''); }}
          >Clear</button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Tên</th>
              <th className="text-left px-3 py-2 font-medium">Key</th>
              <th className="text-left px-3 py-2 font-medium">Monitor URL</th>
              <th className="text-left px-3 py-2 font-medium">NATS</th>
              <th className="text-left px-3 py-2 font-medium">Monitor</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-3 py-3 text-gray-500">Đang tải…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-3 text-gray-500">Không có cụm nào</td></tr>
            )}
            {!loading && filtered.map(c => (
              <tr key={c.key} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{c.label}</td>
                <td className="px-3 py-2 text-gray-600">{c.key}</td>
                <td className="px-3 py-2">
                  {c.monitorUrl ? (
                    <a href={c.monitorUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{c.monitorUrl}</a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span title="NATS" className={`inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 ${status[c.key]?.natsOk === true ? 'bg-green-500' : status[c.key]?.natsOk === false ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                  <span className="text-gray-600">{status[c.key]?.natsOk === true ? 'OK' : status[c.key]?.natsOk === false ? 'Lỗi' : '—'}</span>
                </td>
                <td className="px-3 py-2">
                  <span title="Monitor" className={`inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 ${status[c.key]?.monitorOk === true ? 'bg-green-500' : status[c.key]?.monitorOk === false ? 'bg-yellow-500' : 'bg-gray-300'}`}></span>
                  <span className="text-gray-600">{status[c.key]?.monitorOk === true ? 'OK' : status[c.key]?.monitorOk === false ? 'Không khả dụng' : '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
