import React, { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Overview from './pages/Overview'
import PubSub from './pages/PubSub'
import Cluster from './pages/Cluster'
import JetStream from './pages/JetStream'
import Advisories from './pages/Advisories'
import Sidebar from './components/Sidebar'
import { getClusters, getRtt, getVarz, setCluster as apiSetCluster } from './api'

// App shell uses a modern Sidebar + Header layout with route-based navigation

export default function App() {
  const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'
  const [clusters, setClusters] = useState<Array<{ key: string; label: string; monitorUrl?: string }>>([])
  const [cluster, setCluster] = useState<string>('')
  const [clErr, setClErr] = useState('')
  const [dark, setDark] = useState(false)
  const initRef = useRef(false)
  const [showClusterMenu, setShowClusterMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [natsOk, setNatsOk] = useState<boolean | null>(null)
  const [monitorOk, setMonitorOk] = useState<boolean | null>(null)
  const [statusMsg, setStatusMsg] = useState<string>('')

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

  // Close cluster menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!showClusterMenu) return
      const t = e.target as Node
      if (menuRef.current && !menuRef.current.contains(t)) {
        setShowClusterMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showClusterMenu])

  // Check NATS and monitor connectivity for current cluster
  useEffect(() => {
    let alive = true
    async function checkOnce() {
      try {
        // NATS RTT
        await getRtt()
        if (!alive) return
        setNatsOk(true)
      } catch (e: any) {
        if (!alive) return
        setNatsOk(false)
        setStatusMsg(e?.message || 'NATS check failed')
      }
      try {
        // Monitor varz
        await getVarz()
        if (!alive) return
        setMonitorOk(true)
      } catch (e: any) {
        if (!alive) return
        setMonitorOk(false)
      }
    }
    // initial and periodic checks
    checkOnce()
    const t = setInterval(checkOnce, 10000)
    return () => { alive = false; clearInterval(t) }
  }, [cluster])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">
        <div className="container-px py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="m-0 text-2xl font-semibold text-gray-800">NATS Web Manager</h1>
            <div className="text-sm text-gray-500">API: {apiBase}</div>
          </div>
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2"
              onClick={() => setShowClusterMenu(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={showClusterMenu}
            >
              <span className="text-gray-700">Cluster:</span>
              <span className="font-medium">{clusters.find(c => c.key === cluster)?.label || '-'}</span>
              <span className="text-gray-500">▾</span>
            </button>
            {showClusterMenu && (
              <div className="absolute right-28 top-12 z-20 w-72 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                <div className="max-h-80 overflow-auto">
                  {clusters.map((c) => {
                    const selected = c.key === cluster
                    return (
                      <button
                        key={c.key}
                        className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-gray-50 ${selected ? 'bg-gray-100' : ''}`}
                        onClick={() => { setCluster(c.key); localStorage.setItem('clusterKey', c.key); setShowClusterMenu(false) }}
                      >
                        <span className={`mt-0.5 inline-block w-4 h-4 rounded-sm border ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}></span>
                        <span className="flex-1">
                          <div className="font-medium text-gray-800">{c.label}</div>
                          {c.monitorUrl && <div className="text-xs text-gray-500 truncate">{c.monitorUrl}</div>}
                        </span>
                      </button>
                    )
                  })}
                  {clusters.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">No clusters configured</div>
                  )}
                </div>
              </div>
            )}
            {/* Status badges */}
            <div className={`text-xs px-2 py-1 rounded ${natsOk === false ? 'bg-red-100 text-red-700' : natsOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{natsOk === null ? 'NATS …' : natsOk ? 'NATS OK' : 'NATS error'}</div>
            <div className={`text-xs px-2 py-1 rounded ${monitorOk === false ? 'bg-yellow-100 text-yellow-800' : monitorOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{monitorOk === null ? 'Monitor …' : monitorOk ? 'Monitor OK' : 'Monitor unavailable'}</div>
            <button className="button" onClick={() => setDark(v => !v)} aria-label="Toggle dark mode">{dark ? '🌙' : '☀️'}</button>
          </div>
        </div>
        {(clErr || natsOk === false || monitorOk === false) && (
          <div className="container-px pb-2 text-sm">
            {clErr && <div className="text-red-600">{clErr}</div>}
            {natsOk === false && <div className="text-red-600">Cannot reach NATS for this cluster. {statusMsg && `(${statusMsg})`}</div>}
            {monitorOk === false && <div className="text-yellow-700">Monitor endpoints (8222) are not reachable for this cluster. Some data (varz/connz/etc) will be unavailable.</div>}
          </div>
        )}
      </header>

      <div className="container-px">
        <div className="flex gap-6">
          <Sidebar />
          <main key={cluster} className="flex-1 py-6">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/pubsub" element={<PubSub />} />
              <Route path="/cluster" element={<Cluster />} />
              <Route path="/jetstream" element={<JetStream />} />
              <Route path="/advisories" element={<Advisories />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
