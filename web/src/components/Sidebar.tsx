import React from 'react'
import { NavLink } from 'react-router-dom'

const nav = [
  { to: '/overview', label: 'Overview' },
  { to: '/pubsub', label: 'Pub/Sub' },
  { to: '/cluster', label: 'Cluster' },
  { to: '/jetstream', label: 'JetStream' },
  { to: '/advisories', label: 'Advisories' },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:block w-60 shrink-0 h-[calc(100vh-57px)] sticky top-[57px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <nav className="p-3 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }: { isActive: boolean }) =>
              `block rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
