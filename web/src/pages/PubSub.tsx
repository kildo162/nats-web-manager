import React, { useEffect, useRef, useState } from 'react'
import { publish, subscribe } from '../api'

export default function PubSub() {
  // Publish state
  const [pubSubject, setPubSubject] = useState('demo.hello')
  const [payload, setPayload] = useState('{"msg":"hello"}')
  const [pubResp, setPubResp] = useState('')

  // Subscribe state
  const [subSubject, setSubSubject] = useState('demo.>')
  const [active, setActive] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const unsubRef = useRef<null | (() => void)>(null)

  useEffect(() => () => { if (unsubRef.current) unsubRef.current() }, [])

  async function doPublish() {
    try {
      const data = JSON.parse(payload)
      await publish(pubSubject, data)
      setPubResp('Published')
    } catch (e: any) {
      setPubResp(`Error: ${e.message}`)
    }
    setTimeout(() => setPubResp(''), 1500)
  }

  function toggleSub() {
    if (active) {
      unsubRef.current?.()
      unsubRef.current = null
      setActive(false)
    } else {
      setMessages([])
      unsubRef.current = subscribe(subSubject, (evt) => {
        setMessages(prev => [evt, ...prev].slice(0, 200))
      })
      setActive(true)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">Pub/Sub Console</h2>

      <section className="space-y-2 mb-4">
        <h3 className="text-base font-medium text-gray-700">Publish</h3>
        <div className="flex items-center gap-2">
          <label className="w-[70px] text-sm text-gray-600">Subject</label>
          <input
            value={pubSubject}
            onChange={e => setPubSubject(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button onClick={doPublish} className="button-primary">Publish</button>
          <span className={pubResp.startsWith('Error') ? 'text-red-600 text-sm' : 'text-green-600 text-sm'}>{pubResp}</span>
        </div>
        <textarea
          value={payload}
          onChange={e => setPayload(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium text-gray-700">Subscribe</h3>
        <div className="flex items-center gap-2">
          <label className="w-[70px] text-sm text-gray-600">Subject</label>
          <input
            value={subSubject}
            onChange={e => setSubSubject(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button onClick={toggleSub} className="button">{active ? 'Stop' : 'Start'}</button>
        </div>
        <div className="card p-3 max-h-80 overflow-auto">
          {messages.map((m, i) => (
            <div key={i} className="border-b border-gray-100 dark:border-gray-800 py-2">
              <div className="text-gray-600 text-sm">{m.subject}</div>
              <pre className="m-0 bg-gray-900 text-gray-100 text-sm rounded-md p-2 overflow-auto">{JSON.stringify(m.data, null, 2)}</pre>
            </div>
          ))}
          {messages.length === 0 && <div className="text-gray-500">No messages</div>}
        </div>
      </section>
    </div>
  )
}
// Tailwind styles used instead of inline styles
