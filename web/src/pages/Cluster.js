import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { getConnz, getGatewayz, getLeafz, getRoutez, getSubsz, getVarz } from '../api';
import AutoRefreshDialog from '../components/AutoRefreshDialog';
import DataTable from '../components/DataTable';
export default function Cluster() {
    const [routez, setRoutez] = useState(null);
    const [gatewayz, setGatewayz] = useState(null);
    const [leafz, setLeafz] = useState(null);
    const [connz, setConnz] = useState(null);
    const [subsz, setSubsz] = useState(null);
    const [varz, setVarz] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
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
    const [sortKey, setSortKey] = useState('pending_bytes');
    const [limit, setLimit] = useState(10);
    const [connQuery, setConnQuery] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [showAllRoutes, setShowAllRoutes] = useState(false);
    const [showRoutesJSON, setShowRoutesJSON] = useState(false);
    const [showGatewayJSON, setShowGatewayJSON] = useState(false);
    const [showLeafJSON, setShowLeafJSON] = useState(false);
    const [showConnJSON, setShowConnJSON] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);
    const [panelHovering, setPanelHovering] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
    const nextDataRef = useRef(null);
    const [showRefreshDialog, setShowRefreshDialog] = useState(false);
    const accounts = useMemo(() => {
        const arr = Array.isArray(connz?.connections) ? connz.connections : [];
        const setA = new Set();
        arr.forEach((c) => { if (c?.account)
            setA.add(String(c.account)); });
        return Array.from(setA).sort();
    }, [connz]);
    const hotConns = useMemo(() => {
        try {
            const arr = Array.isArray(connz?.connections) ? connz.connections : [];
            const filteredByAccount = accountFilter ? arr.filter((c) => String(c?.account || '') === accountFilter) : arr;
            const filtered = connQuery
                ? filteredByAccount.filter((c) => {
                    const q = connQuery.toLowerCase();
                    return (String(c?.name || '').toLowerCase().includes(q) ||
                        String(c?.ip || '').toLowerCase().includes(q) ||
                        String(c?.account || '').toLowerCase().includes(q));
                })
                : filteredByAccount;
            return filtered
                .slice()
                .sort((a, b) => Number(b?.[sortKey] || 0) - Number(a?.[sortKey] || 0))
                .slice(0, Math.max(1, Math.min(100, limit || 10)));
        }
        catch {
            return [];
        }
    }, [connz, sortKey, limit, connQuery, accountFilter]);
    const connColumns = useMemo(() => [
        {
            header: 'CID',
            accessorKey: 'cid',
            cell: ({ row }) => _jsxs("div", { children: ["#", row.original?.cid] }),
        },
        {
            header: 'Account',
            accessorKey: 'account',
            cell: ({ row }) => _jsx("div", { children: row.original?.account || '-' }),
        },
        {
            header: 'Pending',
            accessorKey: 'pending_bytes',
            cell: ({ row }) => _jsx("div", { className: "text-right", children: fmtBytes(row.original?.pending_bytes) }),
        },
        {
            header: 'Bytes (in/out)',
            cell: ({ row }) => (_jsxs("div", { className: "text-right", children: [fmtBytes(row.original?.in_bytes), "/", fmtBytes(row.original?.out_bytes)] })),
        },
        {
            header: 'Msgs (in/out)',
            cell: ({ row }) => (_jsxs("div", { className: "text-right", children: [row.original?.in_msgs ?? 0, "/", row.original?.out_msgs ?? 0] })),
        },
        {
            header: 'Subs',
            accessorKey: 'subscriptions',
            cell: ({ row }) => _jsx("div", { className: "text-right", children: row.original?.subscriptions ?? 0 }),
        },
        {
            header: 'Client',
            cell: ({ row }) => _jsxs("div", { children: [(row.original?.name || row.original?.ip || '-'), row.original?.port ? `:${row.original.port}` : ''] }),
        },
        {
            header: 'Lang/Version',
            cell: ({ row }) => _jsx("div", { children: [row.original?.lang, row.original?.version].filter(Boolean).join(' / ') || '-' }),
        },
        {
            header: 'TLS',
            cell: ({ row }) => _jsx("div", { children: tlsSummary(row.original) }),
        },
        {
            header: 'Idle',
            accessorKey: 'idle',
            cell: ({ row }) => _jsx("div", { children: fmtIdle(row.original?.idle) }),
        },
    ], []);
    const fetchAllData = async () => {
        const sortParam = sortKey === 'pending_bytes' ? 'pending' : sortKey;
        const [r, g, l, c, s, v] = await Promise.all([
            getRoutez(),
            getGatewayz(),
            getLeafz(),
            getConnz({ sort: sortParam, order: -1, limit: Math.max(1, Math.min(1000, limit || 10)) }),
            getSubsz({}),
            getVarz({}),
        ]);
        return { r, g, l, c, s, v };
    };
    const applyData = (data) => {
        if (!data)
            return;
        const { r, g, l, c, s, v } = data;
        setRoutez(r);
        setGatewayz(g);
        setLeafz(l);
        setConnz(c);
        setSubsz(s);
        setVarz(v);
        setErr('');
        setLastUpdated(Date.now());
        setHasPendingUpdate(false);
        nextDataRef.current = null;
    };
    const loadAll = async () => {
        try {
            setLoading(true);
            const data = await fetchAllData();
            applyData(data);
        }
        catch (e) {
            // Clear stale data so user sees immediate change on cluster switch
            setRoutez(null);
            setGatewayz(null);
            setLeafz(null);
            setConnz(null);
            setSubsz(null);
            setVarz(null);
            setErr(e?.message || 'failed to load cluster info');
        }
        finally {
            setLoading(false);
        }
    };
    const refreshAll = async () => {
        try {
            const data = await fetchAllData();
            applyData(data);
        }
        catch (e) {
            setErr(e?.message || 'failed to load cluster info');
        }
    };
    const refreshAllDeferred = async () => {
        try {
            const data = await fetchAllData();
            if (document.hidden || inputFocused || panelHovering) {
                nextDataRef.current = data;
                setHasPendingUpdate(true);
            }
            else {
                applyData(data);
            }
        }
        catch (e) {
            setErr(e?.message || 'failed to load cluster info');
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
    }, [auto, intervalMs, sortKey, limit]);
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
    // When sort key or limit changes, refetch connz server-side for correct top-N and order
    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortKey, limit]);
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800", children: "Cluster" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked) }), `Auto refresh (${Math.max(1, Math.round(intervalMs / 1000))}s)`] }), _jsx("button", { onClick: () => refreshAll(), className: "button", children: "Refresh" }), _jsx("button", { onClick: () => setShowRefreshDialog(true), className: "button", children: "Settings" }), _jsx("div", { className: "ml-2 text-xs text-gray-500", children: lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}` : 'No updates yet' })] })] }), hasPendingUpdate && (_jsxs("div", { className: "mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-3", children: [_jsx("span", { children: "New data available" }), _jsx("button", { className: "button", onClick: () => { const d = nextDataRef.current; if (d)
                            applyData(d); }, children: "Apply updates" })] })), _jsx(AutoRefreshDialog, { open: showRefreshDialog, onClose: () => setShowRefreshDialog(false), onSaved: () => {
                    try {
                        setIntervalMs(Number(localStorage.getItem('refresh_interval_ms') || intervalMs));
                    }
                    catch { }
                } }), err && _jsx("div", { className: "text-red-600 text-sm mb-2", children: err }), loading ? (_jsx("div", { className: "text-gray-500", children: "Loading cluster info..." })) : (_jsxs("div", { children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-3", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "px-3 py-2 text-gray-600", children: "Total Conns" }), _jsx("div", { className: "px-3 pb-3 text-2xl font-semibold", children: connz?.total ?? 0 })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "px-3 py-2 text-gray-600", children: "Subscriptions" }), _jsx("div", { className: "px-3 pb-3 text-2xl font-semibold", children: subsz?.num_subscriptions ?? 0 })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "px-3 py-2 text-gray-600", children: "Slow Consumers" }), _jsx("div", { className: "px-3 pb-3 text-2xl font-semibold", children: varz?.slow_consumers ?? 0 })] }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "px-3 py-2 text-gray-600", children: "Max Payload" }), _jsx("div", { className: "px-3 pb-3 text-2xl font-semibold", children: fmtBytes(varz?.max_payload) })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-3", children: [_jsxs(Section, { title: "Routes", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("div", { children: ["Totals: ", routez?.num_routes ?? (routez?.routes?.length || 0)] }), _jsxs("div", { className: "flex items-center gap-2", children: [(routez?.routes?.length || 0) > 10 && (_jsx("button", { className: "button", onClick: () => setShowAllRoutes((v) => !v), children: showAllRoutes ? 'Show less' : `Show all (${routez?.routes?.length || 0})` })), _jsx("button", { className: "button", onClick: () => setShowRoutesJSON((v) => !v), children: showRoutesJSON ? 'Hide JSON' : 'Show JSON' })] })] }), (routez?.routes?.length || 0) ? (_jsx("div", { className: "overflow-auto", onMouseEnter: () => setPanelHovering(true), onMouseLeave: () => setPanelHovering(false), children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-gray-600", children: [_jsx("th", { className: "text-left pr-3", children: "Remote ID" }), _jsx("th", { className: "text-left pr-3", children: "RID" }), _jsx("th", { className: "text-left pr-3", children: "IP" }), _jsx("th", { className: "text-right pr-3", children: "Port" }), _jsx("th", { className: "text-right pr-3", children: "Pending" }), _jsx("th", { className: "text-right pr-3", children: "Subs" }), _jsx("th", { className: "text-right pr-3", children: "Msgs (in/out)" }), _jsx("th", { className: "text-right pr-3", children: "Bytes (in/out)" }), _jsx("th", { className: "text-left pr-3", children: "TLS" }), _jsx("th", { className: "text-left pr-3", children: "Idle" })] }) }), _jsx("tbody", { children: ((routez?.routes || []).slice(0, showAllRoutes ? undefined : 10)).map((r, idx) => (_jsxs("tr", { className: "border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900", children: [_jsx("td", { className: "pr-3", children: r?.remote_id ?? '-' }), _jsx("td", { className: "pr-3", children: r?.rid ?? '-' }), _jsx("td", { className: "pr-3", children: r?.ip ?? '-' }), _jsx("td", { className: "text-right pr-3", children: r?.port ?? '-' }), _jsx("td", { className: "text-right pr-3", children: (() => {
                                                                    const v = (r?.pending_size ?? r?.pending_bytes);
                                                                    return v != null ? fmtBytes(v) : '-';
                                                                })() }), _jsx("td", { className: "text-right pr-3", children: r?.subscriptions ?? r?.subs ?? '-' }), _jsxs("td", { className: "text-right pr-3", children: [(r?.in_msgs ?? 0), " / ", (r?.out_msgs ?? 0)] }), _jsxs("td", { className: "text-right pr-3", children: [fmtBytes(r?.in_bytes), " / ", fmtBytes(r?.out_bytes)] }), _jsx("td", { className: "pr-3", children: tlsSummary(r) }), _jsx("td", { className: "pr-3", children: fmtIdle(r?.idle) })] }, `${r?.rid ?? r?.remote_id ?? idx}`))) })] }) })) : (_jsx("div", { className: "text-gray-500", children: "No routes" })), showRoutesJSON && _jsx(Pre, { obj: routez })] }), _jsxs(Section, { title: "Gateways", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("div", { children: ["Inbound: ", gatewayz?.num_inbound ?? (gatewayz?.inbound?.length || 0), ", Outbound: ", gatewayz?.num_outbound ?? (gatewayz?.outbound?.length || 0)] }), _jsx("button", { className: "button", onClick: () => setShowGatewayJSON((v) => !v), children: showGatewayJSON ? 'Hide JSON' : 'Show JSON' })] }), showGatewayJSON && _jsx(Pre, { obj: gatewayz })] }), _jsxs(Section, { title: "Leafnodes", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("div", { children: ["Total: ", leafz?.num_leafnodes ?? (leafz?.leafnodes?.length || 0)] }), _jsx("button", { className: "button", onClick: () => setShowLeafJSON((v) => !v), children: showLeafJSON ? 'Hide JSON' : 'Show JSON' })] }), showLeafJSON && _jsx(Pre, { obj: leafz })] }), _jsxs(Section, { title: "Connections", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("div", { children: ["Total: ", connz?.total || 0] }), _jsx("button", { className: "button", onClick: () => setShowConnJSON((v) => !v), children: showConnJSON ? 'Hide JSON' : 'Show JSON' })] }), showConnJSON && _jsx(Pre, { obj: connz })] }), _jsxs(Section, { title: "Hot Connections (by pending bytes)", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2 text-sm flex-wrap", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-600", children: "Sort" }), _jsxs("select", { className: "input", value: sortKey, onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), onChange: (e) => setSortKey(e.target.value), children: [_jsx("option", { value: "pending_bytes", children: "pending_bytes" }), _jsx("option", { value: "in_msgs", children: "in_msgs" }), _jsx("option", { value: "out_msgs", children: "out_msgs" }), _jsx("option", { value: "in_bytes", children: "in_bytes" }), _jsx("option", { value: "out_bytes", children: "out_bytes" })] })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-600", children: "Limit" }), _jsx("input", { className: "input w-20", type: "number", min: 1, max: 100, value: limit, onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), onChange: (e) => setLimit(Number(e.target.value)) })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-600", children: "Search" }), _jsx("input", { className: "input w-48", placeholder: "name/ip/account", value: connQuery, onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), onChange: (e) => setConnQuery(e.target.value) })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-600", children: "Account" }), _jsxs("select", { className: "input", value: accountFilter, onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), onChange: (e) => setAccountFilter(e.target.value), children: [_jsx("option", { value: "", children: "All" }), accounts.map((a) => (_jsx("option", { value: a, children: a }, a)))] })] })] }), hotConns?.length ? (_jsx("div", { className: "overflow-auto", onMouseEnter: () => setPanelHovering(true), onMouseLeave: () => setPanelHovering(false), children: _jsx(DataTable, { columns: connColumns, data: hotConns, pageSize: Math.max(1, Math.min(100, limit || 10)), getRowId: (r) => String(r?.cid ?? Math.random()), renderDetail: (c) => (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-800", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium mb-1", children: "Client" }), _jsxs("div", { children: ["Name: ", c?.name || '-'] }), _jsxs("div", { children: ["IP: ", c?.ip || '-', c?.port ? `:${c.port}` : ''] }), _jsxs("div", { children: ["Account: ", c?.account || '-'] })] }), _jsxs("div", { children: [_jsx("div", { className: "font-medium mb-1", children: "TLS" }), _jsxs("div", { children: ["Version: ", c?.tls_version || c?.tls?.version || '-'] }), _jsxs("div", { children: ["Cipher: ", c?.tls_cipher || c?.tls?.cipher || '-'] }), _jsxs("div", { children: ["Verified: ", String(c?.tls_verified ?? c?.tls?.verified ?? '-')] })] }), _jsxs("div", { children: [_jsx("div", { className: "font-medium mb-1", children: "Stats" }), _jsxs("div", { children: ["Pending: ", fmtBytes(c?.pending_bytes)] }), _jsxs("div", { children: ["Msgs: in ", c?.in_msgs ?? 0, " / out ", c?.out_msgs ?? 0] }), _jsxs("div", { children: ["Bytes: in ", fmtBytes(c?.in_bytes), " / out ", fmtBytes(c?.out_bytes)] }), _jsxs("div", { children: ["Subs: ", c?.subscriptions ?? 0] })] })] })) }) })) : (_jsx("div", { className: "text-gray-500", children: "No matching connections" }))] }), _jsxs(Section, { title: "Subscriptions", children: [_jsxs("div", { className: "mb-2", children: ["Total: ", subsz?.num_subscriptions || 0] }), _jsx(Pre, { obj: subsz })] })] })] }))] }));
}
function Section({ title, children }) {
    return (_jsxs("div", { className: "card overflow-hidden", children: [_jsx("div", { className: "px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800", children: title }), _jsx("div", { className: "p-3", children: children })] }));
}
function Pre({ obj }) {
    if (!obj)
        return null;
    return _jsx("pre", { className: "bg-gray-900 text-gray-100 text-sm rounded-lg p-3 overflow-auto", children: JSON.stringify(obj, null, 2) });
}
function SummaryList({ items, label }) {
    if (!items?.length)
        return _jsx("div", { className: "text-gray-500", children: "None" });
    return (_jsx("ul", { className: "list-disc pl-5 my-2 space-y-1", children: items.map((it, idx) => (_jsx("li", { className: "text-sm text-gray-800", children: label(it) }, idx))) }));
}
// Tailwind styles used instead of inline styles
function fmtBytes(n) {
    const v = Number(n || 0);
    if (!isFinite(v) || v <= 0)
        return '0 B';
    if (v < 1024)
        return `${v} B`;
    if (v < 1024 * 1024)
        return `${(v / 1024).toFixed(1)} KB`;
    if (v < 1024 * 1024 * 1024)
        return `${(v / (1024 * 1024)).toFixed(1)} MB`;
    return `${(v / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function fmtIdle(x) {
    if (x == null)
        return '-';
    const n = Number(x);
    if (isFinite(n)) {
        // assume seconds if small, ms if large
        const secs = n > 1e6 ? Math.round(n / 1000) : Math.round(n);
        if (secs < 60)
            return `${secs}s`;
        if (secs < 3600)
            return `${Math.floor(secs / 60)}m`;
        if (secs < 86400)
            return `${Math.floor(secs / 3600)}h`;
        return `${Math.floor(secs / 86400)}d`;
    }
    return String(x);
}
function tlsSummary(c) {
    const ver = c?.tls_version || c?.tls?.version;
    const cipher = c?.tls_cipher || c?.tls?.cipher;
    const verified = c?.tls_verified ?? c?.tls?.verified;
    if (!ver && !cipher)
        return 'No TLS';
    const parts = [ver || '-', cipher || '-'];
    if (verified != null)
        parts.push(verified ? 'verified' : 'unverified');
    return parts.join(' | ');
}
function formatConnSummary(c, sortKey) {
    const id = `#${c?.cid ?? '?'}`;
    const where = `${(c?.name || c?.ip || '-')}:${c?.port ?? ''}`;
    const pending = `pending=${fmtBytes(c?.pending_bytes)}`;
    const msgs = `msgs[in=${c?.in_msgs ?? 0}, out=${c?.out_msgs ?? 0}]`;
    const bytes = `bytes[in=${fmtBytes(c?.in_bytes)}, out=${fmtBytes(c?.out_bytes)}]`;
    const subs = `subs=${c?.subscriptions ?? 0}`;
    const sortVal = `${sortKey}=${sortKey.includes('bytes') ? fmtBytes(c?.[sortKey]) : String(c?.[sortKey] ?? 0)}`;
    return `${id} ${where} ${pending} ${msgs} ${bytes} ${subs} (${sortVal})`;
}
