import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getJsz, jsInfo, jsStreams, jsStreamInfo, jsConsumers, jsConsumerInfo, jsGetMessage, jsStreamPurge, jsStreamDelete, jsConsumerDelete } from '../api'

export default function JetStream() {
  const [jsz, setJsz] = useState<any>(null)
  const [acct, setAcct] = useState<any>(null)
  const [streams, setStreams] = useState<any[]>([])
  const [selectedStream, setSelectedStream] = useState<string>('')
  const [streamInfo, setStreamInfo] = useState<any>(null)
  const [consumers, setConsumers] = useState<any[]>([])
  const [selectedConsumer, setSelectedConsumer] = useState<string>('')
  const [consumerInfo, setConsumerInfo] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(() => {
    try { return localStorage.getItem('js_auto') === '1' } catch { return false }
  })
  const [intervalMs] = useState(5000)
  const [streamQuery, setStreamQuery] = useState('')
  const [showJszJSON, setShowJszJSON] = useState(false)
  const [showAcctJSON, setShowAcctJSON] = useState(false)
  const [showStreamJSON, setShowStreamJSON] = useState(false)
  const [showConsumerJSON, setShowConsumerJSON] = useState(false)
  const [consumerQuery, setConsumerQuery] = useState('')
  const [streamSort, setStreamSort] = useState<'name' | 'msgs' | 'bytes' | 'util'>('name')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warning' | 'error'>('all')

  // Message browsing state
  const [msgSeq, setMsgSeq] = useState<string>('')
  const [msgSubject, setMsgSubject] = useState<string>('')
  const [msgFromSeq, setMsgFromSeq] = useState<number | null>(null)
  const [msg, setMsg] = useState<any>(null)
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgErr, setMsgErr] = useState('')

  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [panelHovering, setPanelHovering] = useState(false)
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false)
  const nextDataRef = useRef<any>(null)
  const isInteracting = useMemo(() => {
    return inputFocused || panelHovering || showJszJSON || showAcctJSON || showStreamJSON || showConsumerJSON
  }, [inputFocused, panelHovering, showJszJSON, showAcctJSON, showStreamJSON, showConsumerJSON])

  useEffect(() => {
    try { localStorage.setItem('js_auto', auto ? '1' : '0') } catch {}
  }, [auto])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [j, a, s] = await Promise.all([
          getJsz({
            consolidated: true,
            account: true,
            config: true,
            streams: true,
            consumers: true,
          }),
          jsInfo(),
          jsStreams(),
        ])
        if (!mounted) return
        setJsz(j)
        setAcct(a)
        setStreams(s)
        if (s[0]?.config?.name) setSelectedStream(s[0].config.name)
      } catch (e: any) {
        setErr(e?.message || 'failed to load JetStream info')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!selectedStream) {
      setStreamInfo(null)
      setConsumers([])
      setSelectedConsumer('')
      setConsumerInfo(null)
      return
    }
    // Clear consumer selection immediately to avoid fetching consumer info with mismatched stream
    setSelectedConsumer('')
    setConsumerInfo(null)
    ;(async () => {
      // Fetch stream info
      try {
        const si = await jsStreamInfo(selectedStream)
        if (!mounted) return
        setStreamInfo(si)
      } catch (e: any) {
        if (!mounted) return
        setStreamInfo(null)
        setErr(e?.message || 'failed to load stream info')
      }
      // Fetch consumers for stream
      try {
        const cs = await jsConsumers(selectedStream)
        if (!mounted) return
        setConsumers(cs)
        if (cs[0]?.name) setSelectedConsumer(cs[0].name)
      } catch (e: any) {
        if (!mounted) return
        setConsumers([])
        setSelectedConsumer('')
        setConsumerInfo(null)
        setErr(e?.message || 'failed to load consumers')
      }
    })()
    return () => { mounted = false }
  }, [selectedStream])

  useEffect(() => {
    let mounted = true
    if (!selectedStream || !selectedConsumer) { setConsumerInfo(null); return }
    ;(async () => {
      try {
        const ci = await jsConsumerInfo(selectedStream, selectedConsumer)
        if (!mounted) return
        setConsumerInfo(ci)
      } catch (e: any) {
        setConsumerInfo(null)
        setErr(e?.message || 'failed to load consumer info')
      }
    })()
    return () => { mounted = false }
  }, [selectedStream, selectedConsumer])

  // Clear message viewer when stream changes
  useEffect(() => {
    setMsg(null)
    setMsgErr('')
    setMsgFromSeq(null)
  }, [selectedStream])

  const jsCluster = useMemo(() => jsz?.jetstream || jsz?.data || jsz, [jsz])
  const filteredStreams = useMemo(() => {
    const q = streamQuery.trim().toLowerCase()
    if (!q) return streams
    try {
      return streams.filter((s: any) => {
        const name = String(s?.config?.name || '').toLowerCase()
        const subjects = (s?.config?.subjects || []).map((x: string) => String(x).toLowerCase())
        return name.includes(q) || subjects.some((x: string) => x.includes(q))
      })
    } catch {
      return streams
    }
  }, [streams, streamQuery])

  const displayStreams = useMemo(() => {
    let arr = filteredStreams
    // filter by status
    if (statusFilter !== 'all') {
      arr = arr.filter((s: any) => streamStatus(s).label === statusFilter)
    }
    // sort
    const byName = (x: any, y: any) => String(x?.config?.name || '').localeCompare(String(y?.config?.name || ''))
    const byMsgs = (x: any, y: any) => Number(y?.state?.messages || 0) - Number(x?.state?.messages || 0)
    const byBytes = (x: any, y: any) => Number(y?.state?.bytes || 0) - Number(x?.state?.bytes || 0)
    const byUtil = (x: any, y: any) => {
      const xu = (() => { const u = Number(x?.state?.bytes || 0); const m = Number(x?.config?.max_bytes || 0); return m > 0 ? u / m : 0 })()
      const yu = (() => { const u = Number(y?.state?.bytes || 0); const m = Number(y?.config?.max_bytes || 0); return m > 0 ? u / m : 0 })()
      return yu - xu
    }
    const cmp = streamSort === 'name' ? byName : streamSort === 'msgs' ? byMsgs : streamSort === 'bytes' ? byBytes : byUtil
    return [...arr].sort(cmp)
  }, [filteredStreams, statusFilter, streamSort])

  const filteredConsumers = useMemo(() => {
    const q = consumerQuery.trim().toLowerCase()
    if (!q) return consumers
    try {
      return consumers.filter((c: any) => String(c?.name || '').toLowerCase().includes(q))
    } catch {
      return consumers
    }
  }, [consumers, consumerQuery])

  function streamStatus(s: any): { label: 'active' | 'warning' | 'error'; className: string } {
    try {
      const used = Number(s?.state?.bytes || s?.state?.bytes_used || 0)
      const maxb = Number(s?.config?.max_bytes || 0)
      let status: 'active' | 'warning' | 'error' = 'active'
      if (isFinite(used) && used > 0 && isFinite(maxb) && maxb > 0) {
        const pct = (used / maxb) * 100
        if (pct >= 90) status = 'error'
        else if (pct >= 75) status = 'warning'
      }
      if (!s?.cluster?.leader) status = 'error'
      return {
        label: status,
        className: status === 'error' ? 'bg-red-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-green-600'
      }
    } catch {
      return { label: 'active', className: 'bg-green-600' }
    }
  }

  // Fetch all data (without committing to state)
  const fetchAllData = async () => {
    const [j, a, sRaw] = await Promise.all([
      getJsz({ consolidated: true, account: true, config: true, streams: true, consumers: true }),
      jsInfo(),
      jsStreams(),
    ])
    const s = Array.isArray(sRaw) ? [...sRaw].sort((x: any, y: any) => String(x?.config?.name || '').localeCompare(String(y?.config?.name || ''))) : []
    let si: any = null, cs: any[] = [], ci: any = null
    if (selectedStream) {
      try { si = await jsStreamInfo(selectedStream) } catch {}
      try {
        const csRaw = await jsConsumers(selectedStream)
        cs = Array.isArray(csRaw) ? [...csRaw].sort((x: any, y: any) => String(x?.name || '').localeCompare(String(y?.name || ''))) : []
      } catch {
        cs = []
      }
      if (selectedConsumer) {
        try { ci = await jsConsumerInfo(selectedStream, selectedConsumer) } catch { ci = null }
      }
    }
    return { j, a, s, si, cs, ci }
  }

  const applyData = (data: any) => {
    if (!data) return
    setJsz(data.j)
    setAcct(data.a)
    setStreams(data.s)
    if (selectedStream) {
      setStreamInfo(data.si)
      setConsumers(data.cs)
      if (selectedConsumer) setConsumerInfo(data.ci)
    }
    setLastUpdated(Date.now())
    setHasPendingUpdate(false)
    nextDataRef.current = null
  }

  // Manual refresh: always apply
  const refreshAll = async () => {
    try {
      const data = await fetchAllData()
      applyData(data)
    } catch (e: any) {
      setErr(e?.message || 'failed to refresh JetStream info')
    }
  }

  // Auto refresh: defer if interacting or tab hidden
  const refreshAllDeferred = async () => {
    try {
      const data = await fetchAllData()
      if (document.hidden || isInteracting) {
        nextDataRef.current = data
        setHasPendingUpdate(true)
      } else {
        applyData(data)
      }
    } catch (e: any) {
      setErr(e?.message || 'failed to refresh JetStream info')
    }
  }

  const applyPendingUpdates = () => {
    if (nextDataRef.current) applyData(nextDataRef.current)
  }

  // Periodic refresh (deferred when interacting/hidden)
  useEffect(() => {
    let active = true
    const run = async () => { if (!active) return; await refreshAllDeferred() }
    let t: any
    if (auto) {
      run()
      t = setInterval(run, intervalMs)
    }
    return () => { active = false; if (t) clearInterval(t) }
  }, [auto, intervalMs, selectedStream, selectedConsumer, isInteracting])

  // Apply pending when tab becomes visible and user not interacting
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && hasPendingUpdate && !isInteracting) {
        applyPendingUpdates()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [hasPendingUpdate, isInteracting])

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">JetStream</h2>
      <div className="flex items-center gap-3 my-2">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto refresh (5s)
        </label>
        <button onClick={() => { refreshAll() }} className="button">Refresh</button>
        <div className="ml-auto text-xs text-gray-500">
          {lastUpdated ? `Cập nhật lần cuối: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Chưa có cập nhật'}
        </div>
      </div>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {loading ? (
        <div className="text-gray-500">Loading JetStream info...</div>
      ) : (
        <>
          {hasPendingUpdate && (
            <div className="mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-3">
              <span>Có dữ liệu mới</span>
              <button className="button" onClick={applyPendingUpdates}>Cập nhật</button>
            </div>
          )}
          <div className="grid grid-cols-[340px_1fr_1fr] gap-3">
          <div>
            <Section title="Streams">
              <div className="mb-2 flex items-center gap-2">
                <input className="input w-full" placeholder="Search by name or subject..." value={streamQuery} onChange={(e) => setStreamQuery(e.target.value)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} />
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    <span>Status</span>
                    <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}>
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>Sort</span>
                    <select className="input" value={streamSort} onChange={(e) => setStreamSort(e.target.value as any)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}>
                      <option value="name">Name</option>
                      <option value="msgs">Messages</option>
                      <option value="bytes">Bytes</option>
                      <option value="util">Utilization</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-1">Streams: {displayStreams.length}</div>
              <div className="max-h-96 overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg" onMouseEnter={() => setPanelHovering(true)} onMouseLeave={() => setPanelHovering(false)}>
                {displayStreams.map((s) => {
                  const cfg = s?.config || {}
                  const name = cfg.name
                  const storage = cfg.storage
                  const replicas = cfg.num_replicas
                  const retention = cfg.retention
                  const subjectsCount = Array.isArray(cfg.subjects) ? cfg.subjects.length : 0
                  const st = streamStatus(s)
                  const used = Number(s?.state?.bytes || 0)
                  const maxb = Number(cfg?.max_bytes || 0)
                  const util = (isFinite(used) && isFinite(maxb) && maxb > 0) ? (used / maxb) * 100 : null
                  const utilBadge = util == null ? null : (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-white text-[10px] ${util >= 90 ? 'bg-red-600' : util >= 75 ? 'bg-yellow-600' : 'bg-green-600'}`}>{util.toFixed(0)}%</span>
                  )
                  return (
                    <div
                      key={name}
                      onClick={() => setSelectedStream(name)}
                      className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-800 ${selectedStream === name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                    >
                      <div className="font-medium flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${st.className}`} title={`Status: ${st.label}`}></span>
                        <span>{name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-700" title={`Status: ${st.label}`}>{st.label}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-700 flex-wrap">
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">msgs: {String(s?.state?.messages ?? '-')}</span>
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">bytes: {fmtBytes(used)}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">util: {utilBadge || '-'}</span>
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">subjects: {subjectsCount}</span>
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">replicas: {String(replicas || 1)}</span>
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900">storage: {String(storage || '-')}</span>
                      </div>
                    </div>
                  )
                })}
                {displayStreams.length === 0 && <div className="p-3 text-gray-500">No streams</div>}
              </div>
            </Section>

            {streamInfo && (
              <Section title="Consumers">
                {(consumers.length > 10) && (
                  <div className="mb-2 flex items-center gap-2">
                    <input className="input w-full" placeholder="Search consumers..." value={consumerQuery} onChange={(e) => setConsumerQuery(e.target.value)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} />
                  </div>
                )}
                <div className="max-h-60 overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                  {filteredConsumers.map((c) => (
                    <div
                      key={c.name}
                      onClick={() => setSelectedConsumer(c.name)}
                      className={`px-3 py-1.5 cursor-pointer ${selectedConsumer === c.name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                    >{c.name}</div>
                  ))}
                  {filteredConsumers.length === 0 && <div className="p-3 text-gray-500">No consumers</div>}
                </div>
              </Section>
            )}
          </div>

          <div onMouseEnter={() => setPanelHovering(true)} onMouseLeave={() => setPanelHovering(false)}>
            {streamInfo && (
              <Section title="Stream Health" sticky>
                <KeyVals
                  items={[
                    ['Name', streamInfo?.config?.name],
                    ['Storage', streamInfo?.config?.storage],
                    ['Replicas', streamInfo?.cluster?.replicas?.length],
                    ['Leader', streamInfo?.cluster?.leader],
                    ['Bytes Used', fmtBytes(streamInfo?.state?.bytes)],
                    ['Max Bytes', streamInfo?.config?.max_bytes ?? '-'],
                    ['Utilization', fmtPct(streamInfo?.state?.bytes, streamInfo?.config?.max_bytes)],
                    ['Msgs', streamInfo?.state?.messages],
                    ['First Seq', streamInfo?.state?.first_seq],
                    ['Last Seq', streamInfo?.state?.last_seq],
                  ]}
                  tips={{
                    'Name': 'Stream name',
                    'Storage': 'Where messages are stored: file or memory.',
                    'Replicas': 'Number of stream replicas in the cluster.',
                    'Leader': 'Server currently leading this stream.',
                    'Bytes Used': 'Current storage used by this stream.',
                    'Max Bytes': 'Configured storage limit for this stream.',
                    'Utilization': 'Bytes used divided by max bytes.',
                    'Msgs': 'Total messages stored in this stream.',
                    'First Seq': 'First sequence number in the stream.',
                    'Last Seq': 'Last sequence number in the stream.'
                  }}
                  links={{
                    'Storage': 'https://docs.nats.io/using-nats/jetstream',
                    'Replicas': 'https://docs.nats.io/using-nats/jetstream',
                    'Leader': 'https://docs.nats.io/using-nats/jetstream',
                    'Max Bytes': 'https://docs.nats.io/using-nats/jetstream',
                    'Utilization': 'https://docs.nats.io/using-nats/jetstream'
                  }}
                />
                {(() => {
                  const used = Number(streamInfo?.state?.bytes || 0)
                  const maxb = Number(streamInfo?.config?.max_bytes || 0)
                  if (!(isFinite(used) && isFinite(maxb) && maxb > 0)) return null
                  const pct = Math.min(100, Math.max(0, (used / maxb) * 100))
                  const bar = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-600'
                  return (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
                        <div>Storage utilization</div>
                        <div>{pct.toFixed(1)}%</div>
                      </div>
                      <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded">
                        <div className={`h-2 ${bar} rounded`} style={{ width: pct + '%' }} />
                      </div>
                    </div>
                  )
                })()}
                {Array.isArray(streamInfo?.cluster?.replicas) && streamInfo.cluster.replicas.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium text-gray-700 mb-1">Replicas</div>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-gray-600">
                          <th className="text-left pr-4">Name</th>
                          <th className="text-left pr-4">Current</th>
                          <th className="text-left pr-4">Active (ms)</th>
                          <th className="text-left pr-4">Lag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {streamInfo.cluster.replicas.map((r: any) => (
                          <tr key={r.name}>
                            <td className="pr-4">{r.name}</td>
                            <td className={`pr-4 ${r.current ? 'text-green-700' : 'text-red-700'}`}>{String(r.current)}</td>
                            <td className="pr-4">{r.active}</td>
                            <td className="pr-4">{r.lag}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            )}

            {streamInfo && (
              <Section title="Stream Config">
                <KeyVals
                  items={[
                    ['Retention', streamInfo?.config?.retention],
                    ['Discard', streamInfo?.config?.discard],
                    ['Max Msgs', streamInfo?.config?.max_msgs],
                    ['Max Bytes', fmtBytes(streamInfo?.config?.max_bytes)],
                    ['Max Age', fmtDurationNs(streamInfo?.config?.max_age)],
                    ['Dedupe Window', fmtDurationNs(streamInfo?.config?.duplicate_window)],
                    ['Replicas', streamInfo?.config?.num_replicas],
                    ['Subjects', Array.isArray(streamInfo?.config?.subjects) ? streamInfo.config.subjects.length : 0],
                    ['Sealed', String(streamInfo?.config?.sealed ?? false)],
                    ['Deny Purge', String(streamInfo?.config?.deny_purge ?? false)],
                    ['Deny Delete', String(streamInfo?.config?.deny_delete ?? false)],
                    ['Mirror', streamInfo?.config?.mirror?.name || '-'],
                    ['Sources', Array.isArray(streamInfo?.config?.sources) ? streamInfo.config.sources.length : 0],
                  ]}
                  tips={{
                    'Retention': 'Policy that controls when messages are removed from the stream.',
                    'Discard': 'Policy for discarding messages when limits are hit.',
                    'Max Msgs': 'Maximum number of messages allowed.',
                    'Max Bytes': 'Maximum bytes allowed for storage.',
                    'Max Age': 'Maximum age before messages expire.',
                    'Dedupe Window': 'Time window for de-duplicating messages.',
                    'Replicas': 'Number of replicas configured for this stream.',
                    'Subjects': 'Number of subjects attached to this stream.',
                    'Sealed': 'Sealed streams disallow further changes.',
                    'Deny Purge': 'Prevent purge operations.',
                    'Deny Delete': 'Prevent delete operations.',
                    'Mirror': 'Upstream stream mirrored into this stream.',
                    'Sources': 'Number of source streams feeding into this stream.'
                  }}
                  links={{
                    'Retention': 'https://docs.nats.io/using-nats/jetstream',
                    'Discard': 'https://docs.nats.io/using-nats/jetstream',
                    'Max Msgs': 'https://docs.nats.io/using-nats/jetstream',
                    'Max Bytes': 'https://docs.nats.io/using-nats/jetstream',
                    'Max Age': 'https://docs.nats.io/using-nats/jetstream',
                    'Dedupe Window': 'https://docs.nats.io/using-nats/jetstream',
                    'Replicas': 'https://docs.nats.io/using-nats/jetstream',
                    'Sealed': 'https://docs.nats.io/using-nats/jetstream',
                    'Deny Purge': 'https://docs.nats.io/using-nats/jetstream',
                    'Deny Delete': 'https://docs.nats.io/using-nats/jetstream',
                    'Mirror': 'https://docs.nats.io/using-nats/jetstream',
                    'Sources': 'https://docs.nats.io/using-nats/jetstream'
                  }}
                />
                <div className="mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button className="button" onClick={() => setShowStreamJSON(v => !v)}>{showStreamJSON ? 'Hide JSON' : 'Show JSON'}</button>
                    <button
                      className="button bg-red-600 hover:bg-red-700"
                      onClick={async () => {
                        if (!selectedStream) return
                        if (!window.confirm(`Purge all messages in stream '${selectedStream}'?`)) return
                        try {
                          await jsStreamPurge(selectedStream)
                          await refreshAll()
                        } catch (e: any) {
                          setErr(e?.message || 'purge failed')
                        }
                      }}
                    >Purge Stream</button>
                    <button
                      className="button bg-red-700 hover:bg-red-800"
                      onClick={async () => {
                        if (!selectedStream) return
                        if (!window.confirm(`Delete stream '${selectedStream}'? This cannot be undone.`)) return
                        try {
                          await jsStreamDelete(selectedStream)
                          // reset selection and refresh
                          setSelectedStream('')
                          await refreshAll()
                        } catch (e: any) {
                          setErr(e?.message || 'delete stream failed')
                        }
                      }}
                    >Delete Stream</button>
                  </div>
                  {showStreamJSON && <div className="mt-2"><Pre obj={streamInfo} /></div>}
                </div>
              </Section>
            )}

            {streamInfo && (
              <Section title="Alerts">
                <ul className="list-disc pl-5 text-sm text-gray-800 space-y-1">
                  {(() => {
                    const alerts: string[] = []
                    const used = Number(streamInfo?.state?.bytes || 0)
                    const maxb = Number(streamInfo?.config?.max_bytes || 0)
                    if (isFinite(used) && used > 0 && isFinite(maxb) && maxb > 0) {
                      const pct = (used / maxb) * 100
                      if (pct >= 90) alerts.push(`High storage utilization: ${pct.toFixed(1)}%`)
                      else if (pct >= 75) alerts.push(`Storage utilization warning: ${pct.toFixed(1)}%`)
                    }
                    if (!streamInfo?.cluster?.leader) alerts.push('No stream leader')
                    const reps: any[] = Array.isArray(streamInfo?.cluster?.replicas) ? streamInfo.cluster.replicas : []
                    reps.forEach((r: any) => {
                      if (!r.current) alerts.push(`Replica not current: ${r.name}`)
                      if (Number(r.lag || 0) > 0) alerts.push(`Replica lag: ${r.name} lag=${r.lag}`)
                    })
                    const consumers = Number(streamInfo?.state?.consumers || 0)
                    if (consumers === 0) alerts.push('No consumers on this stream')
                    return alerts.length ? alerts.map((a, i) => <li key={i}>{a}</li>) : <li>No alerts</li>
                  })()}
                </ul>
              </Section>
            )}

            </div>

            <div onMouseEnter={() => setPanelHovering(true)} onMouseLeave={() => setPanelHovering(false)}>
            {consumerInfo && (
              <Section title={`Consumer: ${selectedConsumer}`}>
                {(() => {
                  const maxAck = Number(consumerInfo?.config?.max_ack_pending || 0)
                  const ackPending = Number(consumerInfo?.num_ack_pending || 0)
                  const ackPct = maxAck > 0 ? (ackPending / maxAck) * 100 : null
                  const redelivered = Number(consumerInfo?.num_redelivered ?? consumerInfo?.num_redeliveries ?? 0)
                  const inactive = consumerInfo?.inactive_threshold
                  const ackBadge = ackPct == null ? null : (
                    <span className={`inline-flex px-2 py-0.5 rounded text-white text-xs ${ackPct >= 80 ? 'bg-red-600' : ackPct >= 50 ? 'bg-yellow-600' : 'bg-green-600'}`}>
                      ack pending {ackPending}/{maxAck} ({ackPct.toFixed(0)}%)
                    </span>
                  )
                  const redBadge = redelivered > 0 ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-orange-600 text-white text-xs">redelivered {redelivered}</span>
                  ) : null
                  const inactiveBadge = inactive ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-gray-700 text-white text-xs">inactive {inactive}s</span>
                  ) : null
                  return (
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {ackBadge}
                      {redBadge}
                      {inactiveBadge}
                    </div>
                  )
                })()}
                <KeyVals
                  items={[
                    ['Ack Pending', consumerInfo?.num_ack_pending],
                    ['Redelivered', consumerInfo?.num_redelivered ?? consumerInfo?.num_redeliveries],
                    ['Num Pending', consumerInfo?.num_pending],
                    ['Max Ack Pending', consumerInfo?.config?.max_ack_pending ?? '-'],
                    ['Inactive (s)', consumerInfo?.inactive_threshold],
                    ['Ack Policy', consumerInfo?.config?.ack_policy],
                    ['Replay Policy', consumerInfo?.config?.replay_policy],
                    ['Deliver Policy', consumerInfo?.config?.deliver_policy],
                  ]}
                  tips={{
                    'Ack Pending': 'Number of messages pending acknowledgment.',
                    'Redelivered': 'Messages redelivered to this consumer.',
                    'Num Pending': 'Messages available to be delivered.',
                    'Max Ack Pending': 'Configured max in-flight messages waiting for ack.',
                    'Inactive (s)': 'Threshold for consumer inactivity in seconds.',
                    'Ack Policy': 'How acknowledgements are required.',
                    'Replay Policy': 'How messages are replayed to this consumer.',
                    'Deliver Policy': 'Where delivery starts in the stream.'
                  }}
                  links={{
                    'Ack Policy': 'https://docs.nats.io/using-nats/jetstream',
                    'Replay Policy': 'https://docs.nats.io/using-nats/jetstream',
                    'Deliver Policy': 'https://docs.nats.io/using-nats/jetstream'
                  }}
                />
                <div className="mt-2">
                  <button className="button" onClick={() => setShowConsumerJSON(v => !v)}>{showConsumerJSON ? 'Hide JSON' : 'Show JSON'}</button>
                  <button
                    className="button bg-red-600 hover:bg-red-700 ml-2"
                    onClick={async () => {
                      if (!selectedStream || !selectedConsumer) return
                      if (!window.confirm(`Delete consumer '${selectedConsumer}' on stream '${selectedStream}'?`)) return
                      try {
                        await jsConsumerDelete(selectedStream, selectedConsumer)
                        // refresh consumers list
                        const cs = await jsConsumers(selectedStream)
                        setConsumers(cs)
                        setSelectedConsumer(cs[0]?.name || '')
                        setConsumerInfo(null)
                      } catch (e: any) {
                        setErr(e?.message || 'delete consumer failed')
                      }
                    }}
                  >Delete Consumer</button>
                  {showConsumerJSON && <div className="mt-2"><Pre obj={consumerInfo} /></div>}
                </div>
              </Section>
            )}

            <Section title="Cluster">
              <KeyVals
                items={[
                  ['Domain', jsCluster?.domain],
                  ['Cluster', jsCluster?.cluster?.name],
                  ['Leader', jsCluster?.cluster?.leader],
                  ['Peers', jsCluster?.cluster?.peers?.length],
                  ['Meta Leader', jsCluster?.meta?.leader],
                  ['Meta Nodes', jsCluster?.meta?.replicas?.length],
                  ['Streams', streams?.length ?? 0],
                  ['Account', acct?.account_id || acct?.tier || '-'],
                ]}
                tips={{
                  'Domain': 'JetStream domain (if configured).',
                  'Cluster': 'JetStream cluster name.',
                  'Leader': 'JetStream meta leader.',
                  'Peers': 'Number of peers in the stream cluster.',
                  'Meta Leader': 'Leader of the meta cluster.',
                  'Meta Nodes': 'Number of nodes in the meta cluster.',
                  'Streams': 'Number of streams in this account.',
                  'Account': 'Current account context.'
                }}
                links={{
                  'Cluster': 'https://docs.nats.io/using-nats/jetstream',
                  'Leader': 'https://docs.nats.io/using-nats/jetstream'
                }}
              />
              <div className="mt-2">
                <button className="button" onClick={() => setShowJszJSON(v => !v)}>{showJszJSON ? 'Hide JSON' : 'Show JSON'}</button>
                {showJszJSON && <div className="mt-2"><Pre obj={jsz} /></div>}
              </div>
            </Section>

            <Section title="Account">
              <div className="mb-2 text-sm text-gray-700">{acct?.account_id || acct?.tier || '-'}</div>
              <button className="button" onClick={() => setShowAcctJSON(v => !v)}>{showAcctJSON ? 'Hide JSON' : 'Show JSON'}</button>
              {showAcctJSON && <div className="mt-2"><Pre obj={acct} /></div>}
            </Section>

            {streamInfo && (
              <Section title="Messages">
                <div className="flex items-end gap-2 flex-wrap">
                  <label className="text-sm text-gray-700">
                    <div className="mb-1">Sequence</div>
                    <input className="input w-40" inputMode="numeric" placeholder="e.g. 1" value={msgSeq} onChange={(e) => setMsgSeq(e.target.value)} />
                  </label>
                  <button
                    className="button"
                    onClick={async () => {
                      if (!selectedStream) return
                      const n = Number(msgSeq)
                      if (!Number.isFinite(n) || n <= 0) { setMsgErr('Invalid sequence'); return }
                      try {
                        setMsgLoading(true); setMsgErr('')
                        const r = await jsGetMessage(selectedStream, { seq: n })
                        setMsg(r)
                        setMsgFromSeq(r?.meta?.seq ?? null)
                      } catch (e: any) {
                        setMsg(null); setMsgErr(e?.message || 'get message failed')
                      } finally { setMsgLoading(false) }
                    }}
                  >Get by Seq</button>

                  <div className="w-px h-8 bg-gray-200" />

                  <label className="text-sm text-gray-700">
                    <div className="mb-1">Subject</div>
                    <input className="input w-64" placeholder="subject or wildcard" value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} />
                  </label>
                  <button
                    className="button"
                    onClick={async () => {
                      if (!selectedStream || !msgSubject.trim()) return
                      try {
                        setMsgLoading(true); setMsgErr('')
                        const r = await jsGetMessage(selectedStream, { last_by_subj: msgSubject.trim() })
                        setMsg(r)
                        setMsgFromSeq(r?.meta?.seq ?? null)
                      } catch (e: any) {
                        setMsg(null); setMsgErr(e?.message || 'get last message failed')
                      } finally { setMsgLoading(false) }
                    }}
                  >Last by Subject</button>
                  <button
                    className="button"
                    onClick={async () => {
                      if (!selectedStream || !msgSubject.trim()) return
                      try {
                        setMsgLoading(true); setMsgErr('')
                        const from = msgFromSeq && msgFromSeq > 0 ? msgFromSeq : undefined
                        const r = await jsGetMessage(selectedStream, { next_by_subj: msgSubject.trim(), from })
                        setMsg(r)
                        setMsgFromSeq(r?.meta?.seq ?? null)
                      } catch (e: any) {
                        setMsg(null); setMsgErr(e?.message || 'get next message failed')
                      } finally { setMsgLoading(false) }
                    }}
                  >Next by Subject</button>
                </div>
                <div className="mt-3">
                  {msgLoading && <div className="text-gray-500 text-sm">Loading message...</div>}
                  {msgErr && <div className="text-red-600 text-sm">{msgErr}</div>}
                  {!msgLoading && !msgErr && msg && (
                    <div className="space-y-2">
                      <KeyVals
                        items={[
                          ['Seq', msg?.meta?.seq],
                          ['Subject', msg?.meta?.subject],
                          ['Time', msg?.meta?.time],
                          ['Size', msg?.meta?.size],
                        ]}
                      />
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Headers</div>
                        <Pre obj={msg?.headers || {}} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Body</div>
                        {msg?.json ? (
                          <Pre obj={msg.json} />
                        ) : msg?.data?.text ? (
                          <pre className="bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto">{msg.data.text}</pre>
                        ) : (
                          <div className="text-sm text-gray-500">Binary data (base64):
                            <div className="mt-1 break-all text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded">{msg?.data?.base64 || '-'}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, children, sticky }: { title: string, children: React.ReactNode, sticky?: boolean }) {
  return (
    <div className={`card ${sticky ? '' : 'overflow-hidden'} mb-3`}>
      <div className={`px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800 ${sticky ? 'sticky top-0 z-10' : ''}`}>{title}</div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function KeyVals({ items, tips, links }: { items: [string, any][], tips?: Record<string, string>, links?: Record<string, string> }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1.5 mb-2">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <div className="text-gray-600 flex items-center gap-1">
            <span>{k}</span>
            {(tips?.[k] || links?.[k]) && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                {tips?.[k] && <span className="cursor-help" title={tips[k]}>?</span>}
                {links?.[k] && (
                  <a href={links[k]} target="_blank" rel="noreferrer" className="underline hover:text-blue-600">docs</a>
                )}
              </span>
            )}
          </div>
          <div>{String(v ?? '-')}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

function Pre({ obj }: { obj: any }) {
  if (!obj) return <div>-</div>
  return <pre className="bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto">{JSON.stringify(obj, null, 2)}</pre>
}

// Tailwind styles used instead of inline styles

function fmtBytes(x: any) {
  const n = Number(x || 0)
  if (!isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function fmtPct(used: any, max: any) {
  const u = Number(used || 0)
  const m = Number(max || 0)
  if (!isFinite(u) || u <= 0 || !isFinite(m) || m <= 0) return '-'
  return `${((u / m) * 100).toFixed(1)}%`
}

function fmtDurationNs(x: any) {
  const n = Number(x || 0)
  if (!isFinite(n) || n <= 0) return '-'
  let ms = n / 1e6
  const parts: string[] = []
  const add = (v: number, suffix: string) => { if (v > 0) parts.push(`${Math.floor(v)}${suffix}`) }
  const d = Math.floor(ms / (24 * 3600 * 1000)); ms -= d * 24 * 3600 * 1000
  const h = Math.floor(ms / (3600 * 1000)); ms -= h * 3600 * 1000
  const m = Math.floor(ms / (60 * 1000)); ms -= m * 60 * 1000
  const s = Math.floor(ms / 1000)
  add(d, 'd'); add(h, 'h'); add(m, 'm'); add(s, 's')
  return parts.length ? parts.join(' ') : '0s'
}
