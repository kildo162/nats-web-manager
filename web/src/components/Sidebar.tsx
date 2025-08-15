import React from 'react'
import { NavLink } from 'react-router-dom'

// Simple inline hero-like icons (no deps). CurrentColor is used to blend with text color
function IconOverview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9l7.5-6 7.5 6v9.75A1.5 1.5 0 0 1 18.75 21h-13.5A1.5 1.5 0 0 1 3.75 18.75V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6h6v6" />
    </svg>
  )
}

function IconList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function IconPubSub(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5l-3-3m0 0l3-3m-3 3h9a6 6 0 0 1 6 6v0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 16.5l3 3m0 0l-3 3m3-3h-9a6 6 0 0 1-6-6v0" />
    </svg>
  )
}

function IconCluster(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path strokeLinecap="round" d="M9.5 8.5l-2 6M14.5 8.5l2 6" />
    </svg>
  )
}

function IconJetStream(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h8.25M21 12h-5.25M11.25 12c0 2.9-2.35 5.25-5.25 5.25S.75 14.9.75 12 3.1 6.75 6 6.75 11.25 9.1 11.25 12zM21 12c0 2.07-1.68 3.75-3.75 3.75S13.5 14.07 13.5 12s1.68-3.75 3.75-3.75S21 9.93 21 12z" />
    </svg>
  )
}

function IconAdvisories(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  )
}

const nav: Array<{ to: string; label: string; icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element }> = [
  { to: '/overview', label: 'Overview', icon: IconOverview },
  { to: '/pubsub', label: 'Pub/Sub', icon: IconPubSub },
  { to: '/clusters', label: 'Clusters', icon: IconList },
  { to: '/cluster', label: 'Cluster', icon: IconCluster },
  { to: '/jetstream', label: 'JetStream', icon: IconJetStream },
  { to: '/advisories', label: 'Advisories', icon: IconAdvisories },
]

type SidebarProps = { mobileOpen?: boolean; onClose?: () => void }

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const NavItems = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <div className="px-2 pb-2 text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400">Navigation</div>
      <div className="space-y-1">
        {nav.map((n) => {
          const Icon = n.icon
          return (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => { onItemClick && onItemClick() }}
              className={({ isActive }: { isActive: boolean }) =>
                `group relative flex items-center gap-3 rounded-md px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/60 dark:bg-indigo-900/30 dark:text-indigo-200'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon className="h-5 w-5 opacity-80 group-hover:opacity-100 transition-opacity" />
              <span className="font-medium">{n.label}</span>
            </NavLink>
          )
        })}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-[calc(100vh-57px)] sticky top-[57px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <nav className="py-3">
          <NavItems />
        </nav>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Navigation</div>
              <button className="text-gray-500 hover:text-gray-800" aria-label="Close menu" onClick={onClose}>✕</button>
            </div>
            <nav className="py-3">
              <NavItems onItemClick={onClose} />
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
