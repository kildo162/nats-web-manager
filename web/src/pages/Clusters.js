import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { getClusters, getClusterStatuses } from '../api';
export default function Clusters() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [clusters, setClusters] = useState([]);
    const [status, setStatus] = useState({});
    const [q, setQ] = useState('');
    // load clusters
    useEffect(() => {
        let alive = true;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const list = await getClusters();
                if (!alive)
                    return;
                // ensure unique by key
                const uniqMap = new Map();
                for (const c of list)
                    if (!uniqMap.has(c.key))
                        uniqMap.set(c.key, c);
                setClusters(Array.from(uniqMap.values()));
            }
            catch (e) {
                if (!alive)
                    return;
                setError(e?.message || 'Failed to load clusters');
            }
            finally {
                if (alive)
                    setLoading(false);
            }
        }
        load();
        const t = setInterval(load, 60000); // refresh list every 60s
        return () => { alive = false; clearInterval(t); };
    }, []);
    // poll statuses
    useEffect(() => {
        let alive = true;
        async function poll() {
            try {
                const list = await getClusterStatuses();
                if (!alive)
                    return;
                const map = {};
                for (const s of list)
                    map[s.key] = { natsOk: !!s.natsOk, monitorOk: !!s.monitorOk };
                setStatus(map);
            }
            catch { }
        }
        poll();
        const t = setInterval(poll, 15000);
        return () => { alive = false; clearInterval(t); };
    }, []);
    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        if (!query)
            return clusters;
        return clusters.filter(c => c.label.toLowerCase().includes(query) ||
            c.key.toLowerCase().includes(query) ||
            (c.monitorUrl ? c.monitorUrl.toLowerCase().includes(query) : false));
    }, [q, clusters]);
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: "Clusters" }), _jsx("p", { className: "text-sm text-gray-500", children: "Danh s\u00E1ch c\u00E1c c\u1EE5m NATS v\u00E0 t\u00ECnh tr\u1EA1ng k\u1EBFt n\u1ED1i (NATS/Monitor)" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "text", value: q, onChange: (e) => setQ(e.target.value), placeholder: "T\u00ECm theo t\u00EAn, key, ho\u1EB7c monitor URL", className: "w-72 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" }), _jsx("button", { className: "rounded-md bg-indigo-600 text-white text-sm px-3 py-2 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500", onClick: () => { setQ(''); }, children: "Clear" })] })] }), error && (_jsx("div", { className: "mb-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm", children: error })), _jsx("div", { className: "overflow-hidden rounded-md border border-gray-200 bg-white", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "bg-gray-50 text-gray-600", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 font-medium", children: "T\u00EAn" }), _jsx("th", { className: "text-left px-3 py-2 font-medium", children: "Key" }), _jsx("th", { className: "text-left px-3 py-2 font-medium", children: "Monitor URL" }), _jsx("th", { className: "text-left px-3 py-2 font-medium", children: "NATS" }), _jsx("th", { className: "text-left px-3 py-2 font-medium", children: "Monitor" })] }) }), _jsxs("tbody", { children: [loading && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-3 py-3 text-gray-500", children: "\u0110ang t\u1EA3i\u2026" }) })), !loading && filtered.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-3 py-3 text-gray-500", children: "Kh\u00F4ng c\u00F3 c\u1EE5m n\u00E0o" }) })), !loading && filtered.map(c => (_jsxs("tr", { className: "border-t border-gray-100 hover:bg-gray-50", children: [_jsx("td", { className: "px-3 py-2 font-medium text-gray-800", children: c.label }), _jsx("td", { className: "px-3 py-2 text-gray-600", children: c.key }), _jsx("td", { className: "px-3 py-2", children: c.monitorUrl ? (_jsx("a", { href: c.monitorUrl, target: "_blank", rel: "noreferrer", className: "text-indigo-600 hover:underline", children: c.monitorUrl })) : (_jsx("span", { className: "text-gray-400", children: "\u2014" })) }), _jsxs("td", { className: "px-3 py-2", children: [_jsx("span", { title: "NATS", className: `inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 ${status[c.key]?.natsOk === true ? 'bg-green-500' : status[c.key]?.natsOk === false ? 'bg-red-500' : 'bg-gray-300'}` }), _jsx("span", { className: "text-gray-600", children: status[c.key]?.natsOk === true ? 'OK' : status[c.key]?.natsOk === false ? 'Lỗi' : '—' })] }), _jsxs("td", { className: "px-3 py-2", children: [_jsx("span", { title: "Monitor", className: `inline-block w-2.5 h-2.5 rounded-full align-middle mr-2 ${status[c.key]?.monitorOk === true ? 'bg-green-500' : status[c.key]?.monitorOk === false ? 'bg-yellow-500' : 'bg-gray-300'}` }), _jsx("span", { className: "text-gray-600", children: status[c.key]?.monitorOk === true ? 'OK' : status[c.key]?.monitorOk === false ? 'Không khả dụng' : '—' })] })] }, c.key)))] })] }) })] }));
}
