import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import AutoRefreshDialog from '../components/AutoRefreshDialog';
import { getRtt, getVarz, jsInfo } from '../api';
export default function Overview() {
    const [varz, setVarz] = useState(null);
    const [info, setInfo] = useState(null);
    const [rtt, setRtt] = useState(null);
    const [err, setErr] = useState('');
    const [auto, setAuto] = useState(() => {
        try {
            return localStorage.getItem('auto_refresh') === '1';
        }
        catch {
            return false;
        }
    });
    const [intervalMs, setIntervalMs] = useState(() => {
        try {
            return Number(localStorage.getItem('refresh_interval_ms') || 5000);
        }
        catch {
            return 5000;
        }
    });
    const prevRef = useRef(null);
    const [rates, setRates] = useState({ inMsgs: 0, outMsgs: 0, inBytes: 0, outBytes: 0 });
    const rttHistRef = useRef([]);
    const [rttStats, setRttStats] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
    const nextDataRef = useRef(null);
    const [showRefreshDialog, setShowRefreshDialog] = useState(false);
    const fetchAllData = async () => {
        const [v, i, r] = await Promise.all([
            getVarz(),
            jsInfo().catch(() => null),
            getRtt().catch(() => ({ rttMs: null })),
        ]);
        const rttVal = r?.rttMs ?? null;
        return { v, i, rttVal };
    };
    const applyData = (data) => {
        if (!data)
            return;
        const { v, i, rttVal } = data;
        setVarz(v);
        setInfo(i);
        setRtt(rttVal);
        // RTT stats
        try {
            if (typeof rttVal === 'number' && isFinite(rttVal)) {
                const hist = rttHistRef.current;
                hist.push(rttVal);
                if (hist.length > 12)
                    hist.shift();
                const min = Math.min(...hist);
                const max = Math.max(...hist);
                const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
                setRttStats({ min, avg, max });
            }
        }
        catch { }
        // throughput rates
        try {
            const now = Date.now();
            const pm = Number(v?.in_msgs ?? 0);
            const om = Number(v?.out_msgs ?? 0);
            const pb = Number(v?.in_bytes ?? 0);
            const ob = Number(v?.out_bytes ?? 0);
            const prev = prevRef.current;
            if (prev && now > prev.t) {
                const dt = (now - prev.t) / 1000;
                const dInM = Math.max(0, pm - prev.in_msgs);
                const dOutM = Math.max(0, om - prev.out_msgs);
                const dInB = Math.max(0, pb - prev.in_bytes);
                const dOutB = Math.max(0, ob - prev.out_bytes);
                setRates({
                    inMsgs: dInM / dt,
                    outMsgs: dOutM / dt,
                    inBytes: dInB / dt,
                    outBytes: dOutB / dt,
                });
            }
            prevRef.current = { t: now, in_msgs: pm, out_msgs: om, in_bytes: pb, out_bytes: ob };
        }
        catch { }
        setLastUpdated(Date.now());
        setHasPendingUpdate(false);
        nextDataRef.current = null;
        setErr('');
    };
    const refreshAll = async () => {
        try {
            const data = await fetchAllData();
            applyData(data);
        }
        catch (e) {
            setErr(e?.message || 'failed to load');
        }
    };
    const refreshAllDeferred = async () => {
        try {
            const data = await fetchAllData();
            if (document.hidden) {
                nextDataRef.current = data;
                setHasPendingUpdate(true);
            }
            else {
                applyData(data);
            }
        }
        catch (e) {
            setErr(e?.message || 'failed to load');
        }
    };
    useEffect(() => {
        try {
            localStorage.setItem('auto_refresh', auto ? '1' : '0');
        }
        catch { }
    }, [auto]);
    useEffect(() => {
        try {
            setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs));
        }
        catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRefreshDialog]);
    useEffect(() => {
        let active = true;
        const run = async () => { if (!active)
            return; await refreshAllDeferred(); };
        if (auto) {
            run();
            const t = setInterval(run, intervalMs);
            return () => { active = false; clearInterval(t); };
        }
        return () => { active = false; };
    }, [auto, intervalMs]);
    // initial load once on mount
    useEffect(() => { refreshAll(); }, []);
    useEffect(() => {
        const onVis = () => {
            if (!document.hidden && hasPendingUpdate) {
                const data = nextDataRef.current;
                if (data)
                    applyData(data);
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [hasPendingUpdate]);
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800", children: "Overview" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked) }), `Auto refresh (${Math.max(1, Math.round(intervalMs / 1000))}s)`] }), _jsx("button", { onClick: () => refreshAll(), className: "button", children: "Refresh" }), _jsx("button", { onClick: () => setShowRefreshDialog(true), className: "button", children: "Settings" }), _jsx("div", { className: "ml-2 text-xs text-gray-500", children: lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'No updates yet' })] })] }), hasPendingUpdate && (_jsxs("div", { className: "mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-3", children: [_jsx("span", { children: "New data available" }), _jsx("button", { className: "button", onClick: () => { const d = nextDataRef.current; if (d)
                            applyData(d); }, children: "Apply updates" })] })), _jsx(AutoRefreshDialog, { open: showRefreshDialog, onClose: () => setShowRefreshDialog(false), onSaved: () => {
                    try {
                        setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs));
                    }
                    catch { }
                } }), err && _jsx("div", { className: "text-red-600 text-sm mb-2", children: err }), _jsxs("section", { children: [_jsx("h3", { className: "text-base font-medium text-gray-700 mb-2", children: "Server (varz)" }), varz ? (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", children: [_jsxs(Card, { title: "Server", children: [_jsx(KV, { k: "ID", v: varz.server_id }), _jsx(KV, { k: "Version", v: varz.version }), _jsx(KV, { k: "Go", v: varz.go }), _jsx(KV, { k: "Host", v: varz.host }), _jsx(KV, { k: "Ports", v: `client ${varz.port}, http ${varz.http_port}` }), _jsx(KV, { k: "JetStream", v: String(varz.jetstream) }), _jsx(KV, { k: "Uptime", v: varz.uptime || '-' })] }), _jsxs(Card, { title: "Connections", children: [_jsx(KV, { k: "Num Conns", v: varz.connections }), _jsx(KV, { k: "Routes", v: varz.routes }), _jsx(KV, { k: "Subs", v: varz.subscriptions })] }), _jsxs(Card, { title: "Memory/CPU", children: [_jsx(KV, { k: "CPU", v: varz.cpu }), _jsx(KV, { k: "Mem", v: `${Math.round((varz.mem || 0) / 1024 / 1024)} MB` }), _jsx(KV, { k: "Cores", v: varz.cores })] }), _jsxs(Card, { title: "Health/Alerts", children: [_jsx(KV, { k: "Slow Consumers", v: varz?.slow_consumers ?? 0 }), _jsx(KV, { k: "Max Payload", v: fmtBytes(varz?.max_payload) }), _jsx(KV, { k: "Max Conns", v: varz?.max_connections ?? '-' }), _jsx(KV, { k: "Write Deadline", v: typeof varz?.write_deadline === 'number' ? `${varz.write_deadline}s` : (varz?.write_deadline || '-') })] }), _jsxs(Card, { title: "Latency", children: [_jsx(KV, { k: "RTT", v: rtt == null ? '-' : fmtMs(rtt) }), rttStats && (_jsxs(_Fragment, { children: [_jsx(KV, { k: "RTT Min", v: fmtMs(rttStats.min) }), _jsx(KV, { k: "RTT Avg", v: fmtMs(rttStats.avg) }), _jsx(KV, { k: "RTT Max", v: fmtMs(rttStats.max) })] }))] }), _jsxs(Card, { title: "Throughput (avg since last refresh)", children: [_jsx(KV, { k: "In Msgs/s", v: fmtRate(rates.inMsgs) }), _jsx(KV, { k: "Out Msgs/s", v: fmtRate(rates.outMsgs) }), _jsx(KV, { k: "In KB/s", v: fmtRate(rates.inBytes / 1024) }), _jsx(KV, { k: "Out KB/s", v: fmtRate(rates.outBytes / 1024) })] })] })) : (_jsx("div", { className: "text-gray-500", children: "Loading varz..." }))] }), _jsxs("section", { className: "mt-4", children: [_jsx("h3", { className: "text-base font-medium text-gray-700 mb-2", children: "JetStream Account" }), info ? (_jsx("pre", { className: "bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto", children: JSON.stringify(info, null, 2) })) : (_jsx("div", { className: "text-gray-500", children: "No JetStream account info or not enabled." }))] })] }));
}
function Card(props) {
    return (_jsxs("div", { className: "card p-4", children: [_jsx("div", { className: "font-semibold text-gray-800 mb-2", children: props.title }), props.children] }));
}
function KV({ k, v }) {
    return (_jsxs("div", { className: "flex justify-between gap-3 py-1 text-sm", children: [_jsx("div", { className: "text-gray-500", children: k }), _jsx("div", { className: "font-medium text-gray-800", children: String(v) })] }));
}
// Tailwind styles used instead of inline styles
function fmtRate(n) {
    if (!isFinite(n) || n <= 0)
        return '0';
    if (n >= 1000)
        return n.toFixed(0);
    if (n >= 100)
        return n.toFixed(1);
    return n.toFixed(2);
}
function fmtMs(n) {
    if (!isFinite(n) || n < 0)
        return '-';
    if (n < 1)
        return `${n.toFixed(2)} ms`;
    if (n < 10)
        return `${n.toFixed(1)} ms`;
    return `${Math.round(n)} ms`;
}
function fmtBytes(x) {
    const n = Number(x || 0);
    if (!isFinite(n) || n <= 0)
        return '0 B';
    if (n < 1024)
        return `${n} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024)
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
