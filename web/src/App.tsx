import React, { useEffect, useRef, useState } from 'react'
import Overview from './pages/Overview'
import PubSub from './pages/PubSub'
import Streams from './pages/Streams'
import Cluster from './pages/Cluster'
import JetStream from './pages/JetStream'
import { getClusters, setCluster as apiSetCluster } from './api'

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'pubsub', label: 'Pub/Sub' },
  { key: 'streams', label: 'Streams' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'jetstream', label: 'JetStream' },
] as const

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('overview')
  const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'
  const [clusters, setClusters] = useState<Array<{ key: string; label: string; monitorUrl?: string }>>([])
  const [cluster, setCluster] = useState<string>('')
  const [clErr, setClErr] = useState('')
  const [dark, setDark] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await getClusters()
        if (!alive) return
        // Deduplicate by key in case backend returns duplicates
        const uniqMap = new Map<string, { key: string; label: string; monitorUrl?: string }>()
        for (const c of list as Array<{ key: string; label: string; monitorUrl?: string }>) {
          if (!uniqMap.has(c.key)) uniqMap.set(c.key, c)
        }
        const uniq = Array.from(uniqMap.values())
        setClusters(uniq)
        try { console.debug('[app] clusters loaded', uniq) } catch {}
        const saved = localStorage.getItem('clusterKey') || ''
        const defKey = (saved && uniq.some((c: { key: string }) => c.key === saved)) ? saved : (uniq?.[0]?.key || '')
        if (!initRef.current) {
          setCluster(defKey)
          apiSetCluster(defKey)
          initRef.current = true
          try { console.debug('[app] init cluster set to', defKey) } catch {}
        }
      } catch (e: any) {
        if (!alive) return
        setClErr(e?.message || 'failed to load clusters')
      }
    })()
    return () => { alive = false }
  }, [])

  // Always sync API client cluster when local state changes
  useEffect(() => {
    if (cluster) {
      apiSetCluster(cluster)
    } else {
      apiSetCluster(undefined)
    }
  }, [cluster])

  useEffect(() => {
    // initialize theme
    const saved = localStorage.getItem('theme')
    const preferDark = saved ? saved === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(preferDark)
    document.documentElement.classList.toggle('dark', preferDark)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="container-px py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="m-0 text-2xl font-semibold text-gray-800">NATS Web Manager</h1>
            <div className="text-sm text-gray-500">API: {apiBase}</div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="cluster" className="text-sm text-gray-700">Cluster</label>
            <select
              id="cluster"
              value={cluster}
              onChange={(e) => { const k = e.target.value; try { console.debug('[app] select change ->', k) } catch {}; setCluster(k); localStorage.setItem('clusterKey', k) }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {clusters.map((c: { key: string; label: string; monitorUrl?: string }) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button className="button" onClick={() => setDark(v => !v)} aria-label="Toggle dark mode">{dark ? '🌙' : '☀️'}</button>
          </div>
        </div>
        {clErr && <div className="container-px pb-2 text-sm text-red-600">{clErr}</div>}
      </header>

      <div className="container-px">
        <nav className="flex gap-2 mt-4">
          {tabs.map(t => {
            const active = tab === t.key
            const base = 'px-3 py-2 rounded-md border text-sm transition-colors'
            const cls = active
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`${base} ${cls}`}>
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      <main key={cluster} className="container-px py-6">
        {tab === 'overview' && <Overview />}
        {tab === 'pubsub' && <PubSub />}
        {tab === 'streams' && <Streams />}
        {tab === 'cluster' && <Cluster />}
        {tab === 'jetstream' && <JetStream />}
      </main>
    </div>
  )
}
