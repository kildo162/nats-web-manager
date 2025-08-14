import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AutoRefreshDialog from '../components/AutoRefreshDialog';
import { getRtt, getVarz, jsInfo } from '../api';
import MiniLineChart from '../components/MiniLineChart';
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
    const inMsgsHistRef = useRef([]);
    const outMsgsHistRef = useRef([]);
    const inBytesHistRef = useRef([]);
    const outBytesHistRef = useRef([]);
    const [rttStats, setRttStats] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    // errors surfaced via query error states
    const [showRefreshDialog, setShowRefreshDialog] = useState(false);
    // React Query data fetching with polling controlled by UI state
    const varzQuery = useQuery({
        queryKey: ['varz'],
        queryFn: async () => await getVarz(),
        refetchInterval: auto ? intervalMs : false,
    });
    const jsInfoQuery = useQuery({
        queryKey: ['jsInfo'],
        queryFn: async () => await jsInfo().catch(() => null),
        refetchInterval: auto ? Math.max(2 * intervalMs, 10000) : false,
    });
    const rttQuery = useQuery({
        queryKey: ['rtt'],
        queryFn: async () => await getRtt().catch(() => ({ rttMs: null })),
        refetchInterval: auto ? intervalMs : false,
    });
    // When queries change, update local derived states
    useEffect(() => {
        if (varzQuery.data) {
            setVarz(varzQuery.data);
            try {
                const now = Date.now();
                const pm = Number(varzQuery.data?.in_msgs ?? 0);
                const om = Number(varzQuery.data?.out_msgs ?? 0);
                const pb = Number(varzQuery.data?.in_bytes ?? 0);
                const ob = Number(varzQuery.data?.out_bytes ?? 0);
                const prev = prevRef.current;
                if (prev && now > prev.t) {
                    const dt = (now - prev.t) / 1000;
                    const dInM = Math.max(0, pm - prev.in_msgs);
                    const dOutM = Math.max(0, om - prev.out_msgs);
                    const dInB = Math.max(0, pb - prev.in_bytes);
                    const dOutB = Math.max(0, ob - prev.out_bytes);
                    setRates({ inMsgs: dInM / dt, outMsgs: dOutM / dt, inBytes: dInB / dt, outBytes: dOutB / dt });
                    // update histories (cap ~60 points)
                    pushCap(inMsgsHistRef.current, dInM / dt, 60);
                    pushCap(outMsgsHistRef.current, dOutM / dt, 60);
                    pushCap(inBytesHistRef.current, dInB / dt, 60);
                    pushCap(outBytesHistRef.current, dOutB / dt, 60);
                }
                prevRef.current = { t: now, in_msgs: pm, out_msgs: om, in_bytes: pb, out_bytes: ob };
            }
            catch { }
            setLastUpdated(Date.now());
        }
    }, [varzQuery.data]);
    useEffect(() => {
        if (jsInfoQuery.data !== undefined) {
            setInfo(jsInfoQuery.data);
            setLastUpdated(Date.now());
        }
    }, [jsInfoQuery.data]);
    useEffect(() => {
        const rttVal = rttQuery.data?.rttMs ?? null;
        setRtt(rttVal);
        if (typeof rttVal === 'number' && isFinite(rttVal)) {
            try {
                const hist = rttHistRef.current;
                hist.push(rttVal);
                if (hist.length > 12)
                    hist.shift();
                const min = Math.min(...hist);
                const max = Math.max(...hist);
                const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
                setRttStats({ min, avg, max });
            }
            catch { }
        }
        if (rttQuery.data)
            setLastUpdated(Date.now());
    }, [rttQuery.data]);
    const refreshAll = async () => {
        try {
            await Promise.all([varzQuery.refetch(), jsInfoQuery.refetch(), rttQuery.refetch()]);
            setErr('');
        }
        catch (e) {
            setErr(e?.message || 'failed to load');
        }
    };
    // no deferred refresh needed as React Query pauses on hidden by default
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
    // React Query handles polling; no manual intervals needed
    // initial manual kick (optional)
    useEffect(() => { refreshAll(); }, []);
    // React Query already supports focus/visibility behaviors
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800", children: "Overview" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked) }), `Auto refresh (${Math.max(1, Math.round(intervalMs / 1000))}s)`] }), _jsx("button", { onClick: () => refreshAll(), className: "button", children: "Refresh" }), _jsx("button", { onClick: () => setShowRefreshDialog(true), className: "button", children: "Settings" }), _jsx("div", { className: "ml-2 text-xs text-gray-500", children: lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'No updates yet' })] })] }), _jsx(AutoRefreshDialog, { open: showRefreshDialog, onClose: () => setShowRefreshDialog(false), onSaved: () => {
                    try {
                        setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs));
                    }
                    catch { }
                } }), err && _jsx("div", { className: "text-red-600 text-sm mb-2", children: err }), (varzQuery.error || jsInfoQuery.error || rttQuery.error) && (_jsx("div", { className: "text-red-600 text-sm mb-2", children: "Failed to fetch some data." })), _jsxs("section", { children: [_jsx("h3", { className: "text-base font-medium text-gray-700 mb-2", children: "Server (varz)" }), varz ? (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", children: [_jsxs(Card, { title: "Server", children: [_jsx(KV, { k: "ID", v: varz.server_id }), _jsx(KV, { k: "Version", v: varz.version }), _jsx(KV, { k: "Go", v: varz.go }), _jsx(KV, { k: "Host", v: varz.host }), _jsx(KV, { k: "Ports", v: `client ${varz.port}, http ${varz.http_port}` }), _jsx(KV, { k: "JetStream", v: String(varz.jetstream) }), _jsx(KV, { k: "Uptime", v: varz.uptime || '-' })] }), _jsxs(Card, { title: "Connections", children: [_jsx(KV, { k: "Num Conns", v: varz.connections }), _jsx(KV, { k: "Routes", v: varz.routes }), _jsx(KV, { k: "Subs", v: varz.subscriptions })] }), _jsxs(Card, { title: "Memory/CPU", children: [_jsx(KV, { k: "CPU", v: varz.cpu }), _jsx(KV, { k: "Mem", v: `${Math.round((varz.mem || 0) / 1024 / 1024)} MB` }), _jsx(KV, { k: "Cores", v: varz.cores })] }), _jsxs(Card, { title: "Health/Alerts", children: [_jsx(KV, { k: "Slow Consumers", v: varz?.slow_consumers ?? 0 }), _jsx(KV, { k: "Max Payload", v: fmtBytes(varz?.max_payload) }), _jsx(KV, { k: "Max Conns", v: varz?.max_connections ?? '-' }), _jsx(KV, { k: "Write Deadline", v: typeof varz?.write_deadline === 'number' ? `${varz.write_deadline}s` : (varz?.write_deadline || '-') })] }), _jsxs(Card, { title: "Latency", children: [_jsx(KV, { k: "RTT", v: rtt == null ? '-' : fmtMs(rtt) }), rttStats && (_jsxs(_Fragment, { children: [_jsx(KV, { k: "RTT Min", v: fmtMs(rttStats.min) }), _jsx(KV, { k: "RTT Avg", v: fmtMs(rttStats.avg) }), _jsx(KV, { k: "RTT Max", v: fmtMs(rttStats.max) })] })), _jsx("div", { className: "mt-2", children: _jsx(MiniLineChart, { data: rttHistRef.current.slice(), color: "#22c55e", height: 64, format: fmtMsShort }) })] }), _jsxs(Card, { title: "Throughput (live)", children: [_jsx(KV, { k: "In Msgs/s", v: fmtRate(rates.inMsgs) }), _jsx(KV, { k: "Out Msgs/s", v: fmtRate(rates.outMsgs) }), _jsx("div", { className: "mt-2", children: _jsx(MiniLineChart, { data: inMsgsHistRef.current.slice(), color: "#3b82f6", height: 48, format: (v) => `${fmtRate(v)} msg/s` }) }), _jsx("div", { className: "mt-2", children: _jsx(MiniLineChart, { data: outMsgsHistRef.current.slice(), color: "#a855f7", height: 48, format: (v) => `${fmtRate(v)} msg/s` }) }), _jsx(KV, { k: "In KB/s", v: fmtRate(rates.inBytes / 1024) }), _jsx(KV, { k: "Out KB/s", v: fmtRate(rates.outBytes / 1024) }), _jsx("div", { className: "mt-2", children: _jsx(MiniLineChart, { data: inBytesHistRef.current.slice(), color: "#06b6d4", height: 48, format: (v) => `${fmtRate(v / 1024)} KB/s` }) }), _jsx("div", { className: "mt-2", children: _jsx(MiniLineChart, { data: outBytesHistRef.current.slice(), color: "#f59e0b", height: 48, format: (v) => `${fmtRate(v / 1024)} KB/s` }) })] })] })) : (_jsx("div", { className: "text-gray-500", children: "Loading varz..." }))] }), _jsxs("section", { className: "mt-4", children: [_jsx("h3", { className: "text-base font-medium text-gray-700 mb-2", children: "JetStream Account" }), info ? (_jsx("pre", { className: "bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto", children: JSON.stringify(info, null, 2) })) : (_jsx("div", { className: "text-gray-500", children: "No JetStream account info or not enabled." }))] })] }));
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
function pushCap(arr, v, cap = 60) {
    arr.push(v);
    if (arr.length > cap)
        arr.splice(0, arr.length - cap);
}
function fmtMsShort(n) {
    if (!isFinite(n) || n < 0)
        return '-';
    if (n < 1)
        return `${n.toFixed(2)}ms`;
    if (n < 10)
        return `${n.toFixed(1)}ms`;
    return `${Math.round(n)}ms`;
}
