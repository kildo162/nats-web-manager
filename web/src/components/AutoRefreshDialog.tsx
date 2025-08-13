import React, { useEffect, useState } from 'react'

export default function AutoRefreshDialog({ open, onClose, onSaved }: { open: boolean, onClose: () => void, onSaved?: () => void }) {
  const [seconds, setSeconds] = useState<number>(5)
  const [autoDefault, setAutoDefault] = useState<boolean>(false)

  useEffect(() => {
    if (!open) return
    try {
      const ms = Number(localStorage.getItem('refresh_interval_ms') || 5000)
      setSeconds(Math.max(1, Math.round(ms / 1000)))
    } catch {}
    try {
      setAutoDefault(localStorage.getItem('auto_refresh') === '1')
    } catch {}
  }, [open])

  const save = () => {
    try { localStorage.setItem('refresh_interval_ms', String(Math.max(1000, seconds * 1000))) } catch {}
    try { localStorage.setItem('auto_refresh', autoDefault ? '1' : '0') } catch {}
    onSaved && onSaved()
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-950 rounded-lg shadow-xl w-full max-w-md p-4 border border-gray-200 dark:border-gray-800">
        <div className="text-lg font-semibold mb-3 text-gray-800">Auto Refresh Settings</div>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-gray-700">Interval (seconds)</span>
            <input type="number" min={1} className="input w-28" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-gray-700">Default Auto Refresh</span>
            <input type="checkbox" checked={autoDefault} onChange={(e) => setAutoDefault(e.target.checked)} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="button" onClick={onClose}>Cancel</button>
          <button className="button-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
