import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribe } from '../api';
// Lightweight viewer for NATS $SYS.> and $JS.EVENT.>
// Uses existing SSE endpoint /api/subscribe via subscribe() helper
// Shows recent events with filtering and pause/resume controls
export default function Advisories() {
    const [running, setRunning] = useState(true);
    const [events, setEvents] = useState([]);
    const [filter, setFilter] = useState('');
    const [maxRows, setMaxRows] = useState(200);
    const unsubRef = useRef(null);
    const [err, setErr] = useState('');
    const start = () => {
        stop();
        try {
            const off1 = subscribe('$SYS.>', onEvt);
            const off2 = subscribe('$JS.EVENT.>', onEvt);
            unsubRef.current = () => { try {
                off1();
            }
            catch { } ; try {
                off2();
            }
            catch { } };
            setErr('');
        }
        catch (e) {
            setErr(e?.message || 'subscribe error');
        }
    };
    const stop = () => {
        try {
            unsubRef.current?.();
        }
        catch { }
        unsubRef.current = null;
    };
    const onEvt = (msg) => {
        if (!msg || !msg.subject)
            return;
        setEvents((prev) => {
            const next = [
                { time: Date.now(), subject: String(msg.subject), data: msg.data },
                ...prev,
            ];
            if (next.length > Math.max(50, Math.min(2000, maxRows)))
                next.length = maxRows;
            return next;
        });
    };
    useEffect(() => {
        if (running)
            start();
        return () => stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running]);
    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q)
            return events;
        return events.filter((e) => e.subject.toLowerCase().includes(q) || JSON.stringify(e.data).toLowerCase().includes(q));
    }, [events, filter]);
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800", children: "Advisories / Events" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: running, onChange: (e) => setRunning(e.target.checked) }), "Live (SSE)"] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("span", { children: "Max rows" }), _jsx("input", { className: "input w-24", type: "number", min: 50, max: 2000, value: maxRows, onChange: (e) => setMaxRows(Number(e.target.value || 200)) })] }), _jsx("button", { className: "button", onClick: () => setEvents([]), children: "Clear" })] })] }), err && _jsx("div", { className: "text-red-600 text-sm mb-2", children: err }), _jsxs("div", { className: "card overflow-hidden", children: [_jsxs("div", { className: "px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800 flex items-center gap-3", children: [_jsx("div", { children: "Events" }), _jsx("input", { className: "input flex-1", placeholder: "Filter by subject or payload...", value: filter, onChange: (e) => setFilter(e.target.value) }), _jsxs("div", { className: "text-sm text-gray-500", children: [filtered.length, " / ", events.length] })] }), _jsx("div", { className: "max-h-[70vh] overflow-auto", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 text-gray-600", children: [_jsx("th", { className: "text-left px-3 py-2", children: "Time" }), _jsx("th", { className: "text-left px-3 py-2", children: "Subject" }), _jsx("th", { className: "text-left px-3 py-2", children: "Data" })] }) }), _jsxs("tbody", { children: [filtered.map((e, idx) => (_jsxs("tr", { className: idx % 2 === 0 ? 'bg-white' : 'bg-gray-50', children: [_jsx("td", { className: "align-top px-3 py-2 whitespace-nowrap text-gray-700", children: fmtTime(e.time) }), _jsx("td", { className: "align-top px-3 py-2 font-mono text-gray-800", children: e.subject }), _jsx("td", { className: "align-top px-3 py-2", children: _jsx("pre", { className: "bg-gray-900 text-gray-100 text-xs rounded-md p-2 overflow-auto max-w-[70vw]", children: fmtJson(e.data) }) })] }, idx))), filtered.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "px-3 py-6 text-center text-gray-500", children: "No events" }) }))] })] }) })] })] }));
}
function fmtJson(v) {
    try {
        return JSON.stringify(v, null, 2);
    }
    catch {
        return String(v);
    }
}
function fmtTime(t) {
    try {
        return new Date(t).toLocaleTimeString();
    }
    catch {
        return String(t);
    }
}
