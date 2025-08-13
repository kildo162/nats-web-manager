import React, { useEffect, useState } from 'react'
import { jsStreams, jsStreamInfo } from '../api'

export default function Streams() {
  const [streams, setStreams] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [info, setInfo] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const s = await jsStreams()
        setStreams(s)
        if (s[0]?.config?.name) {
          setSelected(s[0].config.name)
        }
      } catch (e: any) {
        setErr(e?.message || 'failed to load streams')
      }
    })()
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    jsStreamInfo(selected).then(setInfo).catch((e) => setErr(e.message)).finally(() => setLoading(false))
  }, [selected])

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">Streams</h2>
      {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
      <div className="grid grid-cols-[260px_1fr] gap-3">
        <div className="card overflow-hidden">
          <div className="px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800">Streams</div>
          <div className="max-h-96 overflow-auto">
            {streams.map((s) => (
              <div
                key={s.config.name}
                onClick={() => setSelected(s.config.name)}
                className={`px-3 py-2 cursor-pointer ${selected === s.config.name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`}
              >{s.config.name}</div>
            ))}
            {streams.length === 0 && <div className="p-3 text-gray-500">No streams</div>}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="font-semibold text-gray-700">Selected:</div>
            <div>{selected || '-'}</div>
          </div>
          {loading ? (
            <div className="text-gray-500">Loading stream info...</div>
          ) : info ? (
            <pre className="bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto">{JSON.stringify(info, null, 2)}</pre>
          ) : (
            <div className="text-gray-500">Select a stream</div>
          )}
        </div>
      </div>
    </div>
  )
}
// Tailwind styles used instead of inline styles
