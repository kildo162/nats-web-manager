import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Overview from './pages/Overview';
import PubSub from './pages/PubSub';
import Cluster from './pages/Cluster';
import JetStream from './pages/JetStream';
import Advisories from './pages/Advisories';
import Sidebar from './components/Sidebar';
import { getClusters, getRtt, getVarz, setCluster as apiSetCluster } from './api';
// App shell uses a modern Sidebar + Header layout with route-based navigation
export default function App() {
    const apiBase = import.meta.env?.VITE_API_BASE || 'http://localhost:4000';
    const [clusters, setClusters] = useState([]);
    const [cluster, setCluster] = useState('');
    const [clErr, setClErr] = useState('');
    const [dark, setDark] = useState(false);
    const initRef = useRef(false);
    const [showClusterMenu, setShowClusterMenu] = useState(false);
    const menuRef = useRef(null);
    const [natsOk, setNatsOk] = useState(null);
    const [monitorOk, setMonitorOk] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const list = await getClusters();
                if (!alive)
                    return;
                // Deduplicate by key in case backend returns duplicates
                const uniqMap = new Map();
                for (const c of list) {
                    if (!uniqMap.has(c.key))
                        uniqMap.set(c.key, c);
                }
                const uniq = Array.from(uniqMap.values());
                setClusters(uniq);
                try {
                    console.debug('[app] clusters loaded', uniq);
                }
                catch { }
                const saved = localStorage.getItem('clusterKey') || '';
                const defKey = (saved && uniq.some((c) => c.key === saved)) ? saved : (uniq?.[0]?.key || '');
                if (!initRef.current) {
                    setCluster(defKey);
                    apiSetCluster(defKey);
                    initRef.current = true;
                    try {
                        console.debug('[app] init cluster set to', defKey);
                    }
                    catch { }
                }
            }
            catch (e) {
                if (!alive)
                    return;
                setClErr(e?.message || 'failed to load clusters');
            }
        })();
        return () => { alive = false; };
    }, []);
    // Always sync API client cluster when local state changes
    useEffect(() => {
        if (cluster) {
            apiSetCluster(cluster);
        }
        else {
            apiSetCluster(undefined);
        }
    }, [cluster]);
    useEffect(() => {
        // initialize theme
        const saved = localStorage.getItem('theme');
        const preferDark = saved ? saved === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDark(preferDark);
        document.documentElement.classList.toggle('dark', preferDark);
    }, []);
    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    }, [dark]);
    // Close cluster menu on outside click
    useEffect(() => {
        function onDocClick(e) {
            if (!showClusterMenu)
                return;
            const t = e.target;
            if (menuRef.current && !menuRef.current.contains(t)) {
                setShowClusterMenu(false);
            }
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [showClusterMenu]);
    // Check NATS and monitor connectivity for current cluster
    useEffect(() => {
        let alive = true;
        async function checkOnce() {
            try {
                // NATS RTT
                await getRtt();
                if (!alive)
                    return;
                setNatsOk(true);
            }
            catch (e) {
                if (!alive)
                    return;
                setNatsOk(false);
                setStatusMsg(e?.message || 'NATS check failed');
            }
            try {
                // Monitor varz
                await getVarz();
                if (!alive)
                    return;
                setMonitorOk(true);
            }
            catch (e) {
                if (!alive)
                    return;
                setMonitorOk(false);
            }
        }
        // initial and periodic checks
        checkOnce();
        const t = setInterval(checkOnce, 10000);
        return () => { alive = false; clearInterval(t); };
    }, [cluster]);
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 text-gray-900", children: [_jsxs("header", { className: "sticky top-0 z-10 bg-white border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800", children: [_jsxs("div", { className: "container-px py-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h1", { className: "m-0 text-2xl font-semibold text-gray-800", children: "NATS Web Manager" }), _jsxs("div", { className: "text-sm text-gray-500", children: ["API: ", apiBase] })] }), _jsxs("div", { className: "flex items-center gap-2 relative", ref: menuRef, children: [_jsxs("button", { type: "button", className: "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2", onClick: () => setShowClusterMenu(v => !v), "aria-haspopup": "listbox", "aria-expanded": showClusterMenu, children: [_jsx("span", { className: "text-gray-700", children: "Cluster:" }), _jsx("span", { className: "font-medium", children: clusters.find(c => c.key === cluster)?.label || '-' }), _jsx("span", { className: "text-gray-500", children: "\u25BE" })] }), showClusterMenu && (_jsx("div", { className: "absolute right-28 top-12 z-20 w-72 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden", children: _jsxs("div", { className: "max-h-80 overflow-auto", children: [clusters.map((c) => {
                                                    const selected = c.key === cluster;
                                                    return (_jsxs("button", { className: `w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-gray-50 ${selected ? 'bg-gray-100' : ''}`, onClick: () => { setCluster(c.key); localStorage.setItem('clusterKey', c.key); setShowClusterMenu(false); }, children: [_jsx("span", { className: `mt-0.5 inline-block w-4 h-4 rounded-sm border ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}` }), _jsxs("span", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-800", children: c.label }), c.monitorUrl && _jsx("div", { className: "text-xs text-gray-500 truncate", children: c.monitorUrl })] })] }, c.key));
                                                }), clusters.length === 0 && (_jsx("div", { className: "px-3 py-2 text-sm text-gray-500", children: "No clusters configured" }))] }) })), _jsx("div", { className: `text-xs px-2 py-1 rounded ${natsOk === false ? 'bg-red-100 text-red-700' : natsOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`, children: natsOk === null ? 'NATS …' : natsOk ? 'NATS OK' : 'NATS error' }), _jsx("div", { className: `text-xs px-2 py-1 rounded ${monitorOk === false ? 'bg-yellow-100 text-yellow-800' : monitorOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`, children: monitorOk === null ? 'Monitor …' : monitorOk ? 'Monitor OK' : 'Monitor unavailable' }), _jsx("button", { className: "button", onClick: () => setDark(v => !v), "aria-label": "Toggle dark mode", children: dark ? '🌙' : '☀️' })] })] }), (clErr || natsOk === false || monitorOk === false) && (_jsxs("div", { className: "container-px pb-2 text-sm", children: [clErr && _jsx("div", { className: "text-red-600", children: clErr }), natsOk === false && _jsxs("div", { className: "text-red-600", children: ["Cannot reach NATS for this cluster. ", statusMsg && `(${statusMsg})`] }), monitorOk === false && _jsx("div", { className: "text-yellow-700", children: "Monitor endpoints (8222) are not reachable for this cluster. Some data (varz/connz/etc) will be unavailable." })] }))] }), _jsx("div", { className: "container-px", children: _jsxs("div", { className: "flex gap-6", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 py-6", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/overview", replace: true }) }), _jsx(Route, { path: "/overview", element: _jsx(Overview, {}) }), _jsx(Route, { path: "/pubsub", element: _jsx(PubSub, {}) }), _jsx(Route, { path: "/cluster", element: _jsx(Cluster, {}) }), _jsx(Route, { path: "/jetstream", element: _jsx(JetStream, {}) }), _jsx(Route, { path: "/advisories", element: _jsx(Advisories, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/overview", replace: true }) })] }) }, cluster)] }) })] }));
}
