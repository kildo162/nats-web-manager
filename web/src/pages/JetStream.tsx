import React, { useEffect, useMemo, useState } from 'react'
import { getJsz, jsInfo, jsStreams, jsStreamInfo, jsConsumers, jsConsumerInfo } from '../api'

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
  const [auto, setAuto] = useState(true)
  const [intervalMs] = useState(5000)

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
      return
    }
    ;(async () => {
      try {
        const [si, cs] = await Promise.all([
          jsStreamInfo(selectedStream),
          jsConsumers(selectedStream),
        ])
        if (!mounted) return
        setStreamInfo(si)
        setConsumers(cs)
        if (cs[0]?.name) setSelectedConsumer(cs[0].name)
      } catch (e: any) {
        setErr(e?.message || 'failed to load stream details')
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
        setErr(e?.message || 'failed to load consumer info')
      }
    })()
    return () => { mounted = false }
  }, [selectedStream, selectedConsumer])

  const jsCluster = useMemo(() => jsz?.jetstream || jsz?.data || jsz, [jsz])

  // Unified refresh function used by manual button and interval
  const refreshAll = async () => {
    try {
      const [j, a, s] = await Promise.all([
        getJsz({ consolidated: true, account: true, config: true, streams: true, consumers: true }),
        jsInfo(),
        jsStreams(),
      ])
      setJsz(j)
      setAcct(a)
      setStreams(s)
      if (selectedStream) {
        const [si, cs] = await Promise.all([
          jsStreamInfo(selectedStream),
          jsConsumers(selectedStream),
        ])
        setStreamInfo(si)
        setConsumers(cs)
        if (selectedConsumer) {
          const ci = await jsConsumerInfo(selectedStream, selectedConsumer)
          setConsumerInfo(ci)
        }
      }
    } catch (e: any) {
      setErr(e?.message || 'failed to refresh JetStream info')
    }
  }

  // Periodic refresh (top-level JSZ/account/streams and selected details)
  useEffect(() => {
    let active = true
    const run = async () => { if (!active) return; await refreshAll() }
    run()
    let t: any
    if (auto) t = setInterval(run, intervalMs)
    return () => { active = false; if (t) clearInterval(t) }
  }, [auto, intervalMs, selectedStream, selectedConsumer])

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">JetStream</h2>
      <div className="flex items-center gap-3 my-2">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="rounded" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto refresh (5s)
        </label>
        <button onClick={() => { refreshAll() }} className="button">Refresh</button>
      </div>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      {loading ? (
        <div className="text-gray-500">Loading JetStream info...</div>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-3">
          <div>
            <Section title="Streams">
              <div className="max-h-96 overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                {streams.map((s) => (
                  <div
                    key={s.config.name}
                    onClick={() => setSelectedStream(s.config.name)}
                    className={`px-3 py-2 cursor-pointer ${selectedStream === s.config.name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                  >{s.config.name}</div>
                ))}
                {streams.length === 0 && <div className="p-3 text-gray-500">No streams</div>}
              </div>
            </Section>

            {streamInfo && (
              <Section title="Consumers">
                <div className="max-h-60 overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                  {consumers.map((c) => (
                    <div
                      key={c.name}
                      onClick={() => setSelectedConsumer(c.name)}
                      className={`px-3 py-1.5 cursor-pointer ${selectedConsumer === c.name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                    >{c.name}</div>
                  ))}
                  {consumers.length === 0 && <div className="p-3 text-gray-500">No consumers</div>}
                </div>
              </Section>
            )}
          </div>

          <div>
            <Section title="Cluster">
              <KeyVals
                items={[
                  ['Domain', jsCluster?.domain],
                  ['Cluster', jsCluster?.cluster?.name],
                  ['Leader', jsCluster?.cluster?.leader],
                  ['Peers', jsCluster?.cluster?.peers?.length],
                  ['Meta Leader', jsCluster?.meta?.leader],
                  ['Meta Nodes', jsCluster?.meta?.replicas?.length],
                  ['Account', acct?.account_id || acct?.tier || '-'],
                ]}
              />
              <Pre obj={jsz} />
            </Section>

            <Section title="Account">
              <Pre obj={acct} />
            </Section>

            {streamInfo && (
              <Section title={`Stream: ${selectedStream}`}>
                <Pre obj={streamInfo} />
              </Section>
            )}

            {consumerInfo && (
              <Section title={`Consumer: ${selectedConsumer}`}>
                <Pre obj={consumerInfo} />
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden mb-3">
      <div className="px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function KeyVals({ items }: { items: [string, any][] }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 mb-2">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <div className="text-gray-600">{k}</div>
          <div>{String(v ?? '-')} 
          </div>
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
