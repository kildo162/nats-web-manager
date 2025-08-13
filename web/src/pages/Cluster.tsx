import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getConnz, getGatewayz, getLeafz, getRoutez, getSubsz, getVarz } from '../api'
import AutoRefreshDialog from '../components/AutoRefreshDialog'

export default function Cluster() {
  const [routez, setRoutez] = useState<any>(null)
  const [gatewayz, setGatewayz] = useState<any>(null)
  const [leafz, setLeafz] = useState<any>(null)
  const [connz, setConnz] = useState<any>(null)
  const [subsz, setSubsz] = useState<any>(null)
  const [varz, setVarz] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState<boolean>(() => {
    try { return localStorage.getItem('auto_refresh') === '1' } catch { return false }
  })
  const [intervalMs, setIntervalMs] = useState<number>(() => {
    try { return Number(localStorage.getItem('refresh_interval_ms') || 5000) } catch { return 5000 }
  })
  const [sortKey, setSortKey] = useState<'pending_bytes' | 'in_bytes' | 'out_bytes' | 'in_msgs' | 'out_msgs'>('pending_bytes')
  const [limit, setLimit] = useState<number>(10)
  const [connQuery, setConnQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [showAllRoutes, setShowAllRoutes] = useState(false)
  const [showRoutesJSON, setShowRoutesJSON] = useState(false)
  const [showGatewayJSON, setShowGatewayJSON] = useState(false)
  const [showLeafJSON, setShowLeafJSON] = useState(false)
  const [showConnJSON, setShowConnJSON] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [panelHovering, setPanelHovering] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false)
  const nextDataRef = useRef<any>(null)
  const [showRefreshDialog, setShowRefreshDialog] = useState(false)

  const accounts = useMemo(() => {
    const arr = Array.isArray(connz?.connections) ? (connz.connections as any[]) : []
    const setA = new Set<string>()
    arr.forEach((c: any) => { if (c?.account) setA.add(String(c.account)) })
    return Array.from(setA).sort()
  }, [connz])

  const hotConns = useMemo(() => {
    try {
      const arr = Array.isArray(connz?.connections) ? (connz.connections as any[]) : []
      const filteredByAccount = accountFilter ? arr.filter((c: any) => String(c?.account || '') === accountFilter) : arr
      const filtered = connQuery
        ? filteredByAccount.filter((c: any) => {
            const q = connQuery.toLowerCase()
            return (
              String(c?.name || '').toLowerCase().includes(q) ||
              String(c?.ip || '').toLowerCase().includes(q) ||
              String(c?.account || '').toLowerCase().includes(q)
            )
          })
        : filteredByAccount
      return filtered
        .slice()
        .sort((a: any, b: any) => Number(b?.[sortKey] || 0) - Number(a?.[sortKey] || 0))
        .slice(0, Math.max(1, Math.min(100, limit || 10)))
    } catch {
      return [] as any[]
    }
  }, [connz, sortKey, limit, connQuery, accountFilter])

  const fetchAllData = async () => {
    const sortParam = sortKey === 'pending_bytes' ? 'pending' : (sortKey as string)
    const [r, g, l, c, s, v] = await Promise.all([
      getRoutez(),
      getGatewayz(),
      getLeafz(),
      getConnz({ sort: sortParam, order: -1, limit: Math.max(1, Math.min(1000, limit || 10)) }),
      getSubsz({}),
      getVarz({}),
    ])
    return { r, g, l, c, s, v }
  }

  const applyData = (data: any) => {
    if (!data) return
    const { r, g, l, c, s, v } = data
    setRoutez(r)
    setGatewayz(g)
    setLeafz(l)
    setConnz(c)
    setSubsz(s)
    setVarz(v)
    setErr('')
    setLastUpdated(Date.now())
    setHasPendingUpdate(false)
    nextDataRef.current = null
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      const data = await fetchAllData()
      applyData(data)
    } catch (e: any) {
      // Clear stale data so user sees immediate change on cluster switch
      setRoutez(null)
      setGatewayz(null)
      setLeafz(null)
      setConnz(null)
      setSubsz(null)
      setVarz(null)
      setErr(e?.message || 'failed to load cluster info')
    } finally {
      setLoading(false)
    }
  }

  const refreshAll = async () => {
    try {
      const data = await fetchAllData()
      applyData(data)
    } catch (e: any) {
      setErr(e?.message || 'failed to load cluster info')
    }
  }

  const refreshAllDeferred = async () => {
    try {
      const data = await fetchAllData()
      if (document.hidden || inputFocused || panelHovering) {
        nextDataRef.current = data
        setHasPendingUpdate(true)
      } else {
        applyData(data)
      }
    } catch (e: any) {
      setErr(e?.message || 'failed to load cluster info')
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
  }, [auto, intervalMs, sortKey, limit])

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

  // When sort key or limit changes, refetch connz server-side for correct top-N and order
  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, limit])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-800">Cluster</h2>
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
      {loading ? (
        <div className="text-gray-500">Loading cluster info...</div>
      ) : (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="card"><div className="px-3 py-2 text-gray-600">Total Conns</div><div className="px-3 pb-3 text-2xl font-semibold">{connz?.total ?? 0}</div></div>
            <div className="card"><div className="px-3 py-2 text-gray-600">Subscriptions</div><div className="px-3 pb-3 text-2xl font-semibold">{subsz?.num_subscriptions ?? 0}</div></div>
            <div className="card"><div className="px-3 py-2 text-gray-600">Slow Consumers</div><div className="px-3 pb-3 text-2xl font-semibold">{varz?.slow_consumers ?? 0}</div></div>
            <div className="card"><div className="px-3 py-2 text-gray-600">Max Payload</div><div className="px-3 pb-3 text-2xl font-semibold">{fmtBytes(varz?.max_payload)}</div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="Routes">
            <div className="mb-2 flex items-center justify-between">
              <div>Totals: {routez?.num_routes ?? (routez?.routes?.length || 0)}</div>
              <div className="flex items-center gap-2">
                {(routez?.routes?.length || 0) > 10 && (
                  <button className="button" onClick={() => setShowAllRoutes((v) => !v)}>
                    {showAllRoutes ? 'Show less' : `Show all (${routez?.routes?.length || 0})`}
                  </button>
                )}
                <button className="button" onClick={() => setShowRoutesJSON((v) => !v)}>
                  {showRoutesJSON ? 'Hide JSON' : 'Show JSON'}
                </button>
              </div>
            </div>
            {(routez?.routes?.length || 0) ? (
              <div className="overflow-auto" onMouseEnter={() => setPanelHovering(true)} onMouseLeave={() => setPanelHovering(false)}>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-gray-600">
                      <th className="text-left pr-3">Remote ID</th>
                      <th className="text-left pr-3">RID</th>
                      <th className="text-left pr-3">IP</th>
                      <th className="text-right pr-3">Port</th>
                      <th className="text-right pr-3">Pending</th>
                      <th className="text-right pr-3">Subs</th>
                      <th className="text-right pr-3">Msgs (in/out)</th>
                      <th className="text-right pr-3">Bytes (in/out)</th>
                      <th className="text-left pr-3">TLS</th>
                      <th className="text-left pr-3">Idle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((routez?.routes || []).slice(0, showAllRoutes ? undefined : 10)).map((r: any, idx: number) => (
                      <tr key={`${r?.rid ?? r?.remote_id ?? idx}`}
                          className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                        <td className="pr-3">{r?.remote_id ?? '-'}</td>
                        <td className="pr-3">{r?.rid ?? '-'}</td>
                        <td className="pr-3">{r?.ip ?? '-'}</td>
                        <td className="text-right pr-3">{r?.port ?? '-'}</td>
                        <td className="text-right pr-3">{(() => {
                          const v = (r?.pending_size ?? r?.pending_bytes)
                          return v != null ? fmtBytes(v) : '-'
                        })()}</td>
                        <td className="text-right pr-3">{r?.subscriptions ?? r?.subs ?? '-'}</td>
                        <td className="text-right pr-3">{(r?.in_msgs ?? 0)} / {(r?.out_msgs ?? 0)}</td>
                        <td className="text-right pr-3">{fmtBytes(r?.in_bytes)} / {fmtBytes(r?.out_bytes)}</td>
                        <td className="pr-3">{tlsSummary(r)}</td>
                        <td className="pr-3">{fmtIdle(r?.idle)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500">No routes</div>
            )}
            {showRoutesJSON && <Pre obj={routez} />}
          </Section>
          <Section title="Gateways">
            <div className="mb-2 flex items-center justify-between">
              <div>Inbound: {gatewayz?.num_inbound ?? (gatewayz?.inbound?.length || 0)}, Outbound: {gatewayz?.num_outbound ?? (gatewayz?.outbound?.length || 0)}</div>
              <button className="button" onClick={() => setShowGatewayJSON((v) => !v)}>{showGatewayJSON ? 'Hide JSON' : 'Show JSON'}</button>
            </div>
            {showGatewayJSON && <Pre obj={gatewayz} />}
          </Section>
          <Section title="Leafnodes">
            <div className="mb-2 flex items-center justify-between">
              <div>Total: {leafz?.num_leafnodes ?? (leafz?.leafnodes?.length || 0)}</div>
              <button className="button" onClick={() => setShowLeafJSON((v) => !v)}>{showLeafJSON ? 'Hide JSON' : 'Show JSON'}</button>
            </div>
            {showLeafJSON && <Pre obj={leafz} />}
          </Section>
          <Section title="Connections">
            <div className="mb-2 flex items-center justify-between">
              <div>Total: {connz?.total || 0}</div>
              <button className="button" onClick={() => setShowConnJSON((v) => !v)}>{showConnJSON ? 'Hide JSON' : 'Show JSON'}</button>
            </div>
            {showConnJSON && <Pre obj={connz} />}
          </Section>
          <Section title="Hot Connections (by pending bytes)">
            <div className="flex items-center gap-3 mb-2 text-sm flex-wrap">
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Sort</span>
                <select className="input" value={sortKey} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onChange={(e) => setSortKey(e.target.value as any)}>
                  <option value="pending_bytes">pending_bytes</option>
                  <option value="in_msgs">in_msgs</option>
                  <option value="out_msgs">out_msgs</option>
                  <option value="in_bytes">in_bytes</option>
                  <option value="out_bytes">out_bytes</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Limit</span>
                <input className="input w-20" type="number" min={1} max={100} value={limit} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onChange={(e) => setLimit(Number(e.target.value))} />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Search</span>
                <input className="input w-48" placeholder="name/ip/account" value={connQuery} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onChange={(e) => setConnQuery(e.target.value)} />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-gray-600">Account</span>
                <select className="input" value={accountFilter} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onChange={(e) => setAccountFilter(e.target.value)}>
                  <option value="">All</option>
                  {accounts.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            {hotConns?.length ? (
              <div className="overflow-auto" onMouseEnter={() => setPanelHovering(true)} onMouseLeave={() => setPanelHovering(false)}>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-gray-600">
                      <th className="text-left pr-3">CID</th>
                      <th className="text-left pr-3">Account</th>
                      <th className="text-right pr-3">Pending</th>
                      <th className="text-right pr-3">Bytes (in/out)</th>
                      <th className="text-right pr-3">Msgs (in/out)</th>
                      <th className="text-right pr-3">Subs</th>
                      <th className="text-left pr-3">Client</th>
                      <th className="text-left pr-3">Lang/Version</th>
                      <th className="text-left pr-3">TLS</th>
                      <th className="text-left pr-3">Idle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotConns.map((c: any) => (
                      <React.Fragment key={c.cid}>
                        <tr className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={() => setExpanded((prev) => ({ ...prev, [c.cid]: !prev[c.cid] }))}>
                          <td className="pr-3">#{c?.cid}</td>
                          <td className="pr-3">{c?.account || '-'}</td>
                          <td className="pr-3 text-right">{fmtBytes(c?.pending_bytes)}</td>
                          <td className="pr-3 text-right">{fmtBytes(c?.in_bytes)}/{fmtBytes(c?.out_bytes)}</td>
                          <td className="pr-3 text-right">{c?.in_msgs ?? 0}/{c?.out_msgs ?? 0}</td>
                          <td className="pr-3 text-right">{c?.subscriptions ?? 0}</td>
                          <td className="pr-3">{(c?.name || c?.ip || '-')}{c?.port ? `:${c.port}` : ''}</td>
                          <td className="pr-3">{[c?.lang, c?.version].filter(Boolean).join(' / ') || '-'}</td>
                          <td className="pr-3">{tlsSummary(c)}</td>
                          <td className="pr-3">{fmtIdle(c?.idle)}</td>
                        </tr>
                        {expanded[c.cid] && (
                          <tr className="bg-gray-50 dark:bg-gray-900">
                            <td className="p-3" colSpan={10}>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-800">
                                <div>
                                  <div className="font-medium mb-1">Client</div>
                                  <div>Name: {c?.name || '-'}</div>
                                  <div>IP: {c?.ip || '-'}{c?.port ? `:${c.port}` : ''}</div>
                                  <div>Account: {c?.account || '-'}</div>
                                </div>
                                <div>
                                  <div className="font-medium mb-1">TLS</div>
                                  <div>Version: {c?.tls_version || c?.tls?.version || '-'}</div>
                                  <div>Cipher: {c?.tls_cipher || c?.tls?.cipher || '-'}</div>
                                  <div>Verified: {String(c?.tls_verified ?? c?.tls?.verified ?? '-')}</div>
                                </div>
                                <div>
                                  <div className="font-medium mb-1">Stats</div>
                                  <div>Pending: {fmtBytes(c?.pending_bytes)}</div>
                                  <div>Msgs: in {c?.in_msgs ?? 0} / out {c?.out_msgs ?? 0}</div>
                                  <div>Bytes: in {fmtBytes(c?.in_bytes)} / out {fmtBytes(c?.out_bytes)}</div>
                                  <div>Subs: {c?.subscriptions ?? 0}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500">No matching connections</div>
            )}
          </Section>
          <Section title="Subscriptions">
            <div className="mb-2">Total: {subsz?.num_subscriptions || 0}</div>
            <Pre obj={subsz} />
          </Section>
          </div>
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

function fmtIdle(x: any) {
  if (x == null) return '-'
  const n = Number(x)
  if (isFinite(n)) {
    // assume seconds if small, ms if large
    const secs = n > 1e6 ? Math.round(n / 1000) : Math.round(n)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs/60)}m`
    if (secs < 86400) return `${Math.floor(secs/3600)}h`
    return `${Math.floor(secs/86400)}d`
  }
  return String(x)
}

function tlsSummary(c: any) {
  const ver = c?.tls_version || c?.tls?.version
  const cipher = c?.tls_cipher || c?.tls?.cipher
  const verified = c?.tls_verified ?? c?.tls?.verified
  if (!ver && !cipher) return 'No TLS'
  const parts = [ver || '-', cipher || '-']
  if (verified != null) parts.push(verified ? 'verified' : 'unverified')
  return parts.join(' | ')
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
