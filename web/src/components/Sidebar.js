import { jsx as _jsx } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
const nav = [
    { to: '/overview', label: 'Overview' },
    { to: '/pubsub', label: 'Pub/Sub' },
    { to: '/cluster', label: 'Cluster' },
    { to: '/jetstream', label: 'JetStream' },
    { to: '/advisories', label: 'Advisories' },
];
export default function Sidebar() {
    return (_jsx("aside", { className: "hidden md:block w-60 shrink-0 h-[calc(100vh-57px)] sticky top-[57px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900", children: _jsx("nav", { className: "p-3 space-y-1", children: nav.map((n) => (_jsx(NavLink, { to: n.to, className: ({ isActive }) => `block rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`, children: n.label }, n.to))) }) }));
}
