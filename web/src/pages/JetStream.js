import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getJsz, jsInfo, jsStreams, jsStreamInfo, jsConsumers, jsConsumerInfo, jsGetMessage, jsStreamPurge, jsStreamDelete, jsConsumerDelete, jsStreamCreate, jsStreamUpdate, jsConsumerCreate, jsConsumerUpdate } from '../api';
export default function JetStream() {
    const [jsz, setJsz] = useState(null);
    const [acct, setAcct] = useState(null);
    const [streams, setStreams] = useState([]);
    const [selectedStream, setSelectedStream] = useState('');
    const [streamInfo, setStreamInfo] = useState(null);
    const [consumers, setConsumers] = useState([]);
    const [selectedConsumer, setSelectedConsumer] = useState('');
    const [consumerInfo, setConsumerInfo] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    // CRUD modals state
    const [showCreateStream, setShowCreateStream] = useState(false);
    const [showEditStream, setShowEditStream] = useState(false);
    const [streamJsonText, setStreamJsonText] = useState('');
    const [streamModalErr, setStreamModalErr] = useState('');
    const [showCreateConsumer, setShowCreateConsumer] = useState(false);
    const [showEditConsumer, setShowEditConsumer] = useState(false);
    const [consumerJsonText, setConsumerJsonText] = useState('');
    const [consumerModalErr, setConsumerModalErr] = useState('');
    const [auto, setAuto] = useState(() => {
        try {
            return localStorage.getItem('js_auto') === '1';
        }
        catch {
            return false;
        }
    });
    const [intervalMs] = useState(5000);
    const [streamQuery, setStreamQuery] = useState('');
    const [showJszJSON, setShowJszJSON] = useState(false);
    const [showAcctJSON, setShowAcctJSON] = useState(false);
    const [showStreamJSON, setShowStreamJSON] = useState(false);
    const [showConsumerJSON, setShowConsumerJSON] = useState(false);
    const [consumerQuery, setConsumerQuery] = useState('');
    const [streamSort, setStreamSort] = useState('name');
    const [statusFilter, setStatusFilter] = useState('all');
    // Message browsing state
    const [msgSeq, setMsgSeq] = useState('');
    const [msgSubject, setMsgSubject] = useState('');
    const [msgFromSeq, setMsgFromSeq] = useState(null);
    const [msg, setMsg] = useState(null);
    const [msgLoading, setMsgLoading] = useState(false);
    const [msgErr, setMsgErr] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [inputFocused, setInputFocused] = useState(false);
    const [panelHovering, setPanelHovering] = useState(false);
    const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
    const nextDataRef = useRef(null);
    const isInteracting = useMemo(() => {
        return inputFocused || panelHovering || showJszJSON || showAcctJSON || showStreamJSON || showConsumerJSON;
    }, [inputFocused, panelHovering, showJszJSON, showAcctJSON, showStreamJSON, showConsumerJSON]);
    useEffect(() => {
        try {
            localStorage.setItem('js_auto', auto ? '1' : '0');
        }
        catch { }
    }, [auto]);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const [j, a, s] = await Promise.all([
                    getJsz({
                        consolidated: true,
                        account: true,
                        config: true,
                        streams: true,
                        consumers: true,
                    }),
                    jsInfo(),
                    jsStreams(),
                ]);
                if (!mounted)
                    return;
                setJsz(j);
                setAcct(a);
                setStreams(s);
                if (s[0]?.config?.name)
                    setSelectedStream(s[0].config.name);
            }
            catch (e) {
                setErr(e?.message || 'failed to load JetStream info');
            }
            finally {
                setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);
    useEffect(() => {
        let mounted = true;
        if (!selectedStream) {
            setStreamInfo(null);
            setConsumers([]);
            setSelectedConsumer('');
            setConsumerInfo(null);
            return;
        }
        // Clear consumer selection immediately to avoid fetching consumer info with mismatched stream
        setSelectedConsumer('');
        setConsumerInfo(null);
        (async () => {
            // Fetch stream info
            try {
                const si = await jsStreamInfo(selectedStream);
                if (!mounted)
                    return;
                setStreamInfo(si);
            }
            catch (e) {
                if (!mounted)
                    return;
                setStreamInfo(null);
                setErr(e?.message || 'failed to load stream info');
            }
            // Fetch consumers for stream
            try {
                const cs = await jsConsumers(selectedStream);
                if (!mounted)
                    return;
                setConsumers(cs);
                if (cs[0]?.name)
                    setSelectedConsumer(cs[0].name);
            }
            catch (e) {
                if (!mounted)
                    return;
                setConsumers([]);
                setSelectedConsumer('');
                setConsumerInfo(null);
                setErr(e?.message || 'failed to load consumers');
            }
        })();
        return () => { mounted = false; };
    }, [selectedStream]);
    useEffect(() => {
        let mounted = true;
        if (!selectedStream || !selectedConsumer) {
            setConsumerInfo(null);
            return;
        }
        ;
        (async () => {
            try {
                const ci = await jsConsumerInfo(selectedStream, selectedConsumer);
                if (!mounted)
                    return;
                setConsumerInfo(ci);
            }
            catch (e) {
                setConsumerInfo(null);
                setErr(e?.message || 'failed to load consumer info');
            }
        })();
        return () => { mounted = false; };
    }, [selectedStream, selectedConsumer]);
    // Clear message viewer when stream changes
    useEffect(() => {
        setMsg(null);
        setMsgErr('');
        setMsgFromSeq(null);
    }, [selectedStream]);
    const jsCluster = useMemo(() => jsz?.jetstream || jsz?.data || jsz, [jsz]);
    const filteredStreams = useMemo(() => {
        const q = streamQuery.trim().toLowerCase();
        if (!q)
            return streams;
        try {
            return streams.filter((s) => {
                const name = String(s?.config?.name || '').toLowerCase();
                const subjects = (s?.config?.subjects || []).map((x) => String(x).toLowerCase());
                return name.includes(q) || subjects.some((x) => x.includes(q));
            });
        }
        catch {
            return streams;
        }
    }, [streams, streamQuery]);
    const displayStreams = useMemo(() => {
        let arr = filteredStreams;
        // filter by status
        if (statusFilter !== 'all') {
            arr = arr.filter((s) => streamStatus(s).label === statusFilter);
        }
        // sort
        const byName = (x, y) => String(x?.config?.name || '').localeCompare(String(y?.config?.name || ''));
        const byMsgs = (x, y) => Number(y?.state?.messages || 0) - Number(x?.state?.messages || 0);
        const byBytes = (x, y) => Number(y?.state?.bytes || 0) - Number(x?.state?.bytes || 0);
        const byUtil = (x, y) => {
            const xu = (() => { const u = Number(x?.state?.bytes || 0); const m = Number(x?.config?.max_bytes || 0); return m > 0 ? u / m : 0; })();
            const yu = (() => { const u = Number(y?.state?.bytes || 0); const m = Number(y?.config?.max_bytes || 0); return m > 0 ? u / m : 0; })();
            return yu - xu;
        };
        const cmp = streamSort === 'name' ? byName : streamSort === 'msgs' ? byMsgs : streamSort === 'bytes' ? byBytes : byUtil;
        return [...arr].sort(cmp);
    }, [filteredStreams, statusFilter, streamSort]);
    const filteredConsumers = useMemo(() => {
        const q = consumerQuery.trim().toLowerCase();
        if (!q)
            return consumers;
        try {
            return consumers.filter((c) => String(c?.name || '').toLowerCase().includes(q));
        }
        catch {
            return consumers;
        }
    }, [consumers, consumerQuery]);
    function streamStatus(s) {
        try {
            const used = Number(s?.state?.bytes || s?.state?.bytes_used || 0);
            const maxb = Number(s?.config?.max_bytes || 0);
            let status = 'active';
            if (isFinite(used) && used > 0 && isFinite(maxb) && maxb > 0) {
                const pct = (used / maxb) * 100;
                if (pct >= 90)
                    status = 'error';
                else if (pct >= 75)
                    status = 'warning';
            }
            if (!s?.cluster?.leader)
                status = 'error';
            return {
                label: status,
                className: status === 'error' ? 'bg-red-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-green-600'
            };
        }
        catch {
            return { label: 'active', className: 'bg-green-600' };
        }
    }
    // Fetch all data (without committing to state)
    const fetchAllData = async () => {
        const [j, a, sRaw] = await Promise.all([
            getJsz({ consolidated: true, account: true, config: true, streams: true, consumers: true }),
            jsInfo(),
            jsStreams(),
        ]);
        const s = Array.isArray(sRaw) ? [...sRaw].sort((x, y) => String(x?.config?.name || '').localeCompare(String(y?.config?.name || ''))) : [];
        let si = null, cs = [], ci = null;
        if (selectedStream) {
            try {
                si = await jsStreamInfo(selectedStream);
            }
            catch { }
            try {
                const csRaw = await jsConsumers(selectedStream);
                cs = Array.isArray(csRaw) ? [...csRaw].sort((x, y) => String(x?.name || '').localeCompare(String(y?.name || ''))) : [];
            }
            catch {
                cs = [];
            }
            if (selectedConsumer) {
                try {
                    ci = await jsConsumerInfo(selectedStream, selectedConsumer);
                }
                catch {
                    ci = null;
                }
            }
        }
        return { j, a, s, si, cs, ci };
    };
    const applyData = (data) => {
        if (!data)
            return;
        setJsz(data.j);
        setAcct(data.a);
        setStreams(data.s);
        if (selectedStream) {
            setStreamInfo(data.si);
            setConsumers(data.cs);
            if (selectedConsumer)
                setConsumerInfo(data.ci);
        }
        setLastUpdated(Date.now());
        setHasPendingUpdate(false);
        nextDataRef.current = null;
    };
    // Manual refresh: always apply
    const refreshAll = async () => {
        try {
            const data = await fetchAllData();
            applyData(data);
        }
        catch (e) {
            setErr(e?.message || 'failed to refresh JetStream info');
        }
    };
    // Auto refresh: defer if interacting or tab hidden
    const refreshAllDeferred = async () => {
        try {
            const data = await fetchAllData();
            if (document.hidden || isInteracting) {
                nextDataRef.current = data;
                setHasPendingUpdate(true);
            }
            else {
                applyData(data);
            }
        }
        catch (e) {
            setErr(e?.message || 'failed to refresh JetStream info');
        }
    };
    const applyPendingUpdates = () => {
        if (nextDataRef.current)
            applyData(nextDataRef.current);
    };
    // Periodic refresh (deferred when interacting/hidden)
    useEffect(() => {
        let active = true;
        const run = async () => { if (!active)
            return; await refreshAllDeferred(); };
        let t;
        if (auto) {
            run();
            t = setInterval(run, intervalMs);
        }
        return () => { active = false; if (t)
            clearInterval(t); };
    }, [auto, intervalMs, selectedStream, selectedConsumer, isInteracting]);
    // Apply pending when tab becomes visible and user not interacting
    useEffect(() => {
        const onVis = () => {
            if (!document.hidden && hasPendingUpdate && !isInteracting) {
                applyPendingUpdates();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [hasPendingUpdate, isInteracting]);
    return (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800 mb-3", children: "JetStream" }), _jsxs("div", { className: "flex items-center gap-3 my-2", children: [_jsxs("label", { className: "inline-flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", className: "rounded", checked: auto, onChange: (e) => setAuto(e.target.checked) }), "Auto refresh (5s)"] }), _jsx("button", { onClick: () => { refreshAll(); }, className: "button-ghost", children: "Refresh" }), _jsx("div", { className: "ml-auto text-xs text-gray-500", children: lastUpdated ? `Cập nhật lần cuối: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Chưa có cập nhật' })] }), err && _jsx("div", { className: "text-red-600 text-sm mb-2", children: err }), loading ? (_jsx("div", { className: "text-gray-500", children: "Loading JetStream info..." })) : (_jsxs(_Fragment, { children: [hasPendingUpdate && (_jsxs("div", { className: "mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-3", children: [_jsx("span", { children: "C\u00F3 d\u1EEF li\u1EC7u m\u1EDBi" }), _jsx("button", { className: "button-primary", onClick: applyPendingUpdates, children: "C\u1EADp nh\u1EADt" })] })), _jsxs("div", { className: "grid grid-cols-[340px_1fr_1fr] gap-3", children: [_jsxs("div", { children: [_jsxs(Section, { title: "Streams", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [_jsx("input", { className: "input w-full", placeholder: "Search by name or subject...", value: streamQuery, onChange: (e) => setStreamQuery(e.target.value), onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false) }), _jsx("button", { className: "button-primary ml-1", onClick: () => {
                                                            setStreamModalErr('');
                                                            // sensible defaults
                                                            const tpl = {
                                                                name: 'NEW_STREAM',
                                                                subjects: ['demo.>'],
                                                                retention: 'limits',
                                                                storage: 'file',
                                                                num_replicas: 1,
                                                                max_bytes: 0
                                                            };
                                                            setStreamJsonText(JSON.stringify(tpl, null, 2));
                                                            setShowCreateStream(true);
                                                        }, children: "New Stream" })] }), _jsx("div", { className: "mb-2 flex items-center gap-2 text-xs text-gray-600", children: _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsxs("label", { className: "flex items-center gap-1", children: [_jsx("span", { children: "Status" }), _jsxs("select", { className: "input", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "warning", children: "Warning" }), _jsx("option", { value: "error", children: "Error" })] })] }), _jsxs("label", { className: "flex items-center gap-1", children: [_jsx("span", { children: "Sort" }), _jsxs("select", { className: "input", value: streamSort, onChange: (e) => setStreamSort(e.target.value), onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false), children: [_jsx("option", { value: "name", children: "Name" }), _jsx("option", { value: "msgs", children: "Messages" }), _jsx("option", { value: "bytes", children: "Bytes" }), _jsx("option", { value: "util", children: "Utilization" })] })] })] }) }), _jsxs("div", { className: "text-xs text-gray-500 mb-1", children: ["Streams: ", displayStreams.length] }), _jsxs("div", { className: "max-h-96 overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg", onMouseEnter: () => setPanelHovering(true), onMouseLeave: () => setPanelHovering(false), children: [displayStreams.map((s) => {
                                                        const cfg = s?.config || {};
                                                        const name = cfg.name;
                                                        const storage = cfg.storage;
                                                        const replicas = cfg.num_replicas;
                                                        const retention = cfg.retention;
                                                        const subjectsCount = Array.isArray(cfg.subjects) ? cfg.subjects.length : 0;
                                                        const st = streamStatus(s);
                                                        const used = Number(s?.state?.bytes || 0);
                                                        const maxb = Number(cfg?.max_bytes || 0);
                                                        const util = (isFinite(used) && isFinite(maxb) && maxb > 0) ? (used / maxb) * 100 : null;
                                                        const utilBadge = util == null ? null : (_jsxs("span", { className: `inline-flex px-1.5 py-0.5 rounded text-white text-[10px] ${util >= 90 ? 'bg-red-600' : util >= 75 ? 'bg-yellow-600' : 'bg-green-600'}`, children: [util.toFixed(0), "%"] }));
                                                        return (_jsxs("div", { onClick: () => setSelectedStream(name), className: `px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-800 ${selectedStream === name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`, children: [_jsxs("div", { className: "font-medium flex items-center gap-2", children: [_jsx("span", { className: `inline-block w-2.5 h-2.5 rounded-full ${st.className}`, title: `Status: ${st.label}` }), _jsx("span", { children: name }), _jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 text-gray-700", title: `Status: ${st.label}`, children: st.label })] }), _jsxs("div", { className: "mt-1 flex items-center gap-2 text-[11px] text-gray-700 flex-wrap", children: [_jsxs("span", { className: "inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900", children: ["msgs: ", String(s?.state?.messages ?? '-')] }), _jsxs("span", { className: "inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900", children: ["bytes: ", fmtBytes(used)] }), _jsxs("span", { className: "inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900", children: ["util: ", utilBadge || '-'] }), _jsxs("span", { className: "inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900", children: ["subjects: ", subjectsCount] }), _jsxs("span", { className: "inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900", children: ["replicas: ", String(replicas || 1)] }), _jsxs("span", { className: "inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900", children: ["storage: ", String(storage || '-')] })] })] }, name));
                                                    }), displayStreams.length === 0 && _jsx("div", { className: "p-3 text-gray-500", children: "No streams" })] })] }), streamInfo && (_jsxs(Section, { title: "Consumers", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [consumers.length > 10 && (_jsx("input", { className: "input w-full", placeholder: "Search consumers...", value: consumerQuery, onChange: (e) => setConsumerQuery(e.target.value), onFocus: () => setInputFocused(true), onBlur: () => setInputFocused(false) })), _jsx("button", { className: "button-primary ml-auto", onClick: () => {
                                                            setConsumerModalErr('');
                                                            const tpl = {
                                                                durable_name: 'NEW_CONSUMER',
                                                                ack_policy: 'explicit',
                                                                deliver_policy: 'all',
                                                                replay_policy: 'instant',
                                                                max_ack_pending: 1000
                                                            };
                                                            setConsumerJsonText(JSON.stringify(tpl, null, 2));
                                                            setShowCreateConsumer(true);
                                                        }, disabled: !selectedStream, title: !selectedStream ? 'Select a stream first' : '', children: "New Consumer" })] }), _jsxs("div", { className: "max-h-60 overflow-auto border border-gray-200 dark:border-gray-800 rounded-lg", children: [filteredConsumers.map((c) => (_jsx("div", { onClick: () => setSelectedConsumer(c.name), className: `px-3 py-1.5 cursor-pointer ${selectedConsumer === c.name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`, children: c.name }, c.name))), filteredConsumers.length === 0 && _jsx("div", { className: "p-3 text-gray-500", children: "No consumers" })] })] }))] }), _jsxs("div", { onMouseEnter: () => setPanelHovering(true), onMouseLeave: () => setPanelHovering(false), children: [streamInfo && (_jsxs(Section, { title: "Stream Health", sticky: true, children: [_jsx(KeyVals, { items: [
                                                    ['Name', streamInfo?.config?.name],
                                                    ['Storage', streamInfo?.config?.storage],
                                                    ['Replicas', streamInfo?.cluster?.replicas?.length],
                                                    ['Leader', streamInfo?.cluster?.leader],
                                                    ['Bytes Used', fmtBytes(streamInfo?.state?.bytes)],
                                                    ['Max Bytes', streamInfo?.config?.max_bytes ?? '-'],
                                                    ['Utilization', fmtPct(streamInfo?.state?.bytes, streamInfo?.config?.max_bytes)],
                                                    ['Msgs', streamInfo?.state?.messages],
                                                    ['First Seq', streamInfo?.state?.first_seq],
                                                    ['Last Seq', streamInfo?.state?.last_seq],
                                                ], tips: {
                                                    'Name': 'Stream name',
                                                    'Storage': 'Where messages are stored: file or memory.',
                                                    'Replicas': 'Number of stream replicas in the cluster.',
                                                    'Leader': 'Server currently leading this stream.',
                                                    'Bytes Used': 'Current storage used by this stream.',
                                                    'Max Bytes': 'Configured storage limit for this stream.',
                                                    'Utilization': 'Bytes used divided by max bytes.',
                                                    'Msgs': 'Total messages stored in this stream.',
                                                    'First Seq': 'First sequence number in the stream.',
                                                    'Last Seq': 'Last sequence number in the stream.'
                                                }, links: {
                                                    'Storage': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Replicas': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Leader': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Max Bytes': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Utilization': 'https://docs.nats.io/using-nats/jetstream'
                                                } }), (() => {
                                                const used = Number(streamInfo?.state?.bytes || 0);
                                                const maxb = Number(streamInfo?.config?.max_bytes || 0);
                                                if (!(isFinite(used) && isFinite(maxb) && maxb > 0))
                                                    return null;
                                                const pct = Math.min(100, Math.max(0, (used / maxb) * 100));
                                                const bar = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-600';
                                                return (_jsxs("div", { className: "mt-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm text-gray-700 mb-1", children: [_jsx("div", { children: "Storage utilization" }), _jsxs("div", { children: [pct.toFixed(1), "%"] })] }), _jsx("div", { className: "h-2 w-full bg-gray-200 dark:bg-gray-800 rounded", children: _jsx("div", { className: `h-2 ${bar} rounded`, style: { width: pct + '%' } }) })] }));
                                            })(), Array.isArray(streamInfo?.cluster?.replicas) && streamInfo.cluster.replicas.length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("div", { className: "font-medium text-gray-700 mb-1", children: "Replicas" }), _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-gray-600", children: [_jsx("th", { className: "text-left pr-4", children: "Name" }), _jsx("th", { className: "text-left pr-4", children: "Current" }), _jsx("th", { className: "text-left pr-4", children: "Active (ms)" }), _jsx("th", { className: "text-left pr-4", children: "Lag" })] }) }), _jsx("tbody", { children: streamInfo.cluster.replicas.map((r) => (_jsxs("tr", { children: [_jsx("td", { className: "pr-4", children: r.name }), _jsx("td", { className: `pr-4 ${r.current ? 'text-green-700' : 'text-red-700'}`, children: String(r.current) }), _jsx("td", { className: "pr-4", children: r.active }), _jsx("td", { className: "pr-4", children: r.lag })] }, r.name))) })] })] }))] })), streamInfo && (_jsxs(Section, { title: "Stream Config", children: [_jsx(KeyVals, { items: [
                                                    ['Retention', streamInfo?.config?.retention],
                                                    ['Discard', streamInfo?.config?.discard],
                                                    ['Max Msgs', streamInfo?.config?.max_msgs],
                                                    ['Max Bytes', fmtBytes(streamInfo?.config?.max_bytes)],
                                                    ['Max Age', fmtDurationNs(streamInfo?.config?.max_age)],
                                                    ['Dedupe Window', fmtDurationNs(streamInfo?.config?.duplicate_window)],
                                                    ['Replicas', streamInfo?.config?.num_replicas],
                                                    ['Subjects', Array.isArray(streamInfo?.config?.subjects) ? streamInfo.config.subjects.length : 0],
                                                    ['Sealed', String(streamInfo?.config?.sealed ?? false)],
                                                    ['Deny Purge', String(streamInfo?.config?.deny_purge ?? false)],
                                                    ['Deny Delete', String(streamInfo?.config?.deny_delete ?? false)],
                                                    ['Mirror', streamInfo?.config?.mirror?.name || '-'],
                                                    ['Sources', Array.isArray(streamInfo?.config?.sources) ? streamInfo.config.sources.length : 0],
                                                ], tips: {
                                                    'Retention': 'Policy that controls when messages are removed from the stream.',
                                                    'Discard': 'Policy for discarding messages when limits are hit.',
                                                    'Max Msgs': 'Maximum number of messages allowed.',
                                                    'Max Bytes': 'Maximum bytes allowed for storage.',
                                                    'Max Age': 'Maximum age before messages expire.',
                                                    'Dedupe Window': 'Time window for de-duplicating messages.',
                                                    'Replicas': 'Number of replicas configured for this stream.',
                                                    'Subjects': 'Number of subjects attached to this stream.',
                                                    'Sealed': 'Sealed streams disallow further changes.',
                                                    'Deny Purge': 'Prevent purge operations.',
                                                    'Deny Delete': 'Prevent delete operations.',
                                                    'Mirror': 'Upstream stream mirrored into this stream.',
                                                    'Sources': 'Number of source streams feeding into this stream.'
                                                }, links: {
                                                    'Retention': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Discard': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Max Msgs': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Max Bytes': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Max Age': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Dedupe Window': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Replicas': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Sealed': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Deny Purge': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Deny Delete': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Mirror': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Sources': 'https://docs.nats.io/using-nats/jetstream'
                                                } }), _jsxs("div", { className: "mt-2", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("button", { className: "button-ghost", onClick: () => {
                                                                    if (!streamInfo?.config)
                                                                        return;
                                                                    setStreamModalErr('');
                                                                    setStreamJsonText(JSON.stringify(streamInfo.config, null, 2));
                                                                    setShowEditStream(true);
                                                                }, children: "Edit Stream" }), _jsx("button", { className: "button-ghost", onClick: () => setShowStreamJSON(v => !v), children: showStreamJSON ? 'Hide JSON' : 'Show JSON' }), _jsx("button", { className: "button-danger", onClick: async () => {
                                                                    if (!selectedStream)
                                                                        return;
                                                                    if (!window.confirm(`Purge all messages in stream '${selectedStream}'?`))
                                                                        return;
                                                                    try {
                                                                        await jsStreamPurge(selectedStream);
                                                                        await refreshAll();
                                                                    }
                                                                    catch (e) {
                                                                        setErr(e?.message || 'purge failed');
                                                                    }
                                                                }, children: "Purge Stream" }), _jsx("button", { className: "button-danger", onClick: async () => {
                                                                    if (!selectedStream)
                                                                        return;
                                                                    if (!window.confirm(`Delete stream '${selectedStream}'? This cannot be undone.`))
                                                                        return;
                                                                    try {
                                                                        await jsStreamDelete(selectedStream);
                                                                        // reset selection and refresh
                                                                        setSelectedStream('');
                                                                        await refreshAll();
                                                                    }
                                                                    catch (e) {
                                                                        setErr(e?.message || 'delete stream failed');
                                                                    }
                                                                }, children: "Delete Stream" })] }), showStreamJSON && _jsx("div", { className: "mt-2", children: _jsx(Pre, { obj: streamInfo }) })] })] })), streamInfo && (_jsx(Section, { title: "Alerts", children: _jsx("ul", { className: "list-disc pl-5 text-sm text-gray-800 space-y-1", children: (() => {
                                                const alerts = [];
                                                const used = Number(streamInfo?.state?.bytes || 0);
                                                const maxb = Number(streamInfo?.config?.max_bytes || 0);
                                                if (isFinite(used) && used > 0 && isFinite(maxb) && maxb > 0) {
                                                    const pct = (used / maxb) * 100;
                                                    if (pct >= 90)
                                                        alerts.push(`High storage utilization: ${pct.toFixed(1)}%`);
                                                    else if (pct >= 75)
                                                        alerts.push(`Storage utilization warning: ${pct.toFixed(1)}%`);
                                                }
                                                if (!streamInfo?.cluster?.leader)
                                                    alerts.push('No stream leader');
                                                const reps = Array.isArray(streamInfo?.cluster?.replicas) ? streamInfo.cluster.replicas : [];
                                                reps.forEach((r) => {
                                                    if (!r.current)
                                                        alerts.push(`Replica not current: ${r.name}`);
                                                    if (Number(r.lag || 0) > 0)
                                                        alerts.push(`Replica lag: ${r.name} lag=${r.lag}`);
                                                });
                                                const consumers = Number(streamInfo?.state?.consumers || 0);
                                                if (consumers === 0)
                                                    alerts.push('No consumers on this stream');
                                                return alerts.length ? alerts.map((a, i) => _jsx("li", { children: a }, i)) : _jsx("li", { children: "No alerts" });
                                            })() }) }))] }), _jsxs("div", { onMouseEnter: () => setPanelHovering(true), onMouseLeave: () => setPanelHovering(false), children: [consumerInfo && (_jsxs(Section, { title: `Consumer: ${selectedConsumer}`, children: [(() => {
                                                const maxAck = Number(consumerInfo?.config?.max_ack_pending || 0);
                                                const ackPending = Number(consumerInfo?.num_ack_pending || 0);
                                                const ackPct = maxAck > 0 ? (ackPending / maxAck) * 100 : null;
                                                const redelivered = Number(consumerInfo?.num_redelivered ?? consumerInfo?.num_redeliveries ?? 0);
                                                const inactive = consumerInfo?.inactive_threshold;
                                                const ackBadge = ackPct == null ? null : (_jsxs("span", { className: `inline-flex px-2 py-0.5 rounded text-white text-xs ${ackPct >= 80 ? 'bg-red-600' : ackPct >= 50 ? 'bg-yellow-600' : 'bg-green-600'}`, children: ["ack pending ", ackPending, "/", maxAck, " (", ackPct.toFixed(0), "%)"] }));
                                                const redBadge = redelivered > 0 ? (_jsxs("span", { className: "inline-flex px-2 py-0.5 rounded bg-orange-600 text-white text-xs", children: ["redelivered ", redelivered] })) : null;
                                                const inactiveBadge = inactive ? (_jsxs("span", { className: "inline-flex px-2 py-0.5 rounded bg-gray-700 text-white text-xs", children: ["inactive ", inactive, "s"] })) : null;
                                                return (_jsxs("div", { className: "flex items-center gap-2 mb-2 flex-wrap", children: [ackBadge, redBadge, inactiveBadge] }));
                                            })(), _jsx(KeyVals, { items: [
                                                    ['Ack Pending', consumerInfo?.num_ack_pending],
                                                    ['Redelivered', consumerInfo?.num_redelivered ?? consumerInfo?.num_redeliveries],
                                                    ['Num Pending', consumerInfo?.num_pending],
                                                    ['Max Ack Pending', consumerInfo?.config?.max_ack_pending ?? '-'],
                                                    ['Inactive (s)', consumerInfo?.inactive_threshold],
                                                    ['Ack Policy', consumerInfo?.config?.ack_policy],
                                                    ['Replay Policy', consumerInfo?.config?.replay_policy],
                                                    ['Deliver Policy', consumerInfo?.config?.deliver_policy],
                                                ], tips: {
                                                    'Ack Pending': 'Number of messages pending acknowledgment.',
                                                    'Redelivered': 'Messages redelivered to this consumer.',
                                                    'Num Pending': 'Messages available to be delivered.',
                                                    'Max Ack Pending': 'Configured max in-flight messages waiting for ack.',
                                                    'Inactive (s)': 'Threshold for consumer inactivity in seconds.',
                                                    'Ack Policy': 'How acknowledgements are required.',
                                                    'Replay Policy': 'How messages are replayed to this consumer.',
                                                    'Deliver Policy': 'Where delivery starts in the stream.'
                                                }, links: {
                                                    'Ack Policy': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Replay Policy': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Deliver Policy': 'https://docs.nats.io/using-nats/jetstream'
                                                } }), _jsxs("div", { className: "mt-2", children: [_jsx("button", { className: "button-ghost", onClick: () => setShowConsumerJSON(v => !v), children: showConsumerJSON ? 'Hide JSON' : 'Show JSON' }), _jsx("button", { className: "button-ghost ml-2", onClick: () => {
                                                            setConsumerModalErr('');
                                                            // merge common fields to make it easy to edit
                                                            const cfg = { durable_name: selectedConsumer, ...(consumerInfo?.config || {}) };
                                                            setConsumerJsonText(JSON.stringify(cfg, null, 2));
                                                            setShowEditConsumer(true);
                                                        }, children: "Edit Consumer" }), _jsx("button", { className: "button-danger ml-2", onClick: async () => {
                                                            if (!selectedStream || !selectedConsumer)
                                                                return;
                                                            if (!window.confirm(`Delete consumer '${selectedConsumer}' on stream '${selectedStream}'?`))
                                                                return;
                                                            try {
                                                                await jsConsumerDelete(selectedStream, selectedConsumer);
                                                                // refresh consumers list
                                                                const cs = await jsConsumers(selectedStream);
                                                                setConsumers(cs);
                                                                setSelectedConsumer(cs[0]?.name || '');
                                                                setConsumerInfo(null);
                                                            }
                                                            catch (e) {
                                                                setErr(e?.message || 'delete consumer failed');
                                                            }
                                                        }, children: "Delete Consumer" }), showConsumerJSON && _jsx("div", { className: "mt-2", children: _jsx(Pre, { obj: consumerInfo }) })] })] })), _jsxs(Section, { title: "Cluster", children: [_jsx(KeyVals, { items: [
                                                    ['Domain', jsCluster?.domain],
                                                    ['Cluster', jsCluster?.cluster?.name],
                                                    ['Leader', jsCluster?.cluster?.leader],
                                                    ['Peers', jsCluster?.cluster?.peers?.length],
                                                    ['Meta Leader', jsCluster?.meta?.leader],
                                                    ['Meta Nodes', jsCluster?.meta?.replicas?.length],
                                                    ['Streams', streams?.length ?? 0],
                                                    ['Account', acct?.account_id || acct?.tier || '-'],
                                                ], tips: {
                                                    'Domain': 'JetStream domain (if configured).',
                                                    'Cluster': 'JetStream cluster name.',
                                                    'Leader': 'JetStream meta leader.',
                                                    'Peers': 'Number of peers in the stream cluster.',
                                                    'Meta Leader': 'Leader of the meta cluster.',
                                                    'Meta Nodes': 'Number of nodes in the meta cluster.',
                                                    'Streams': 'Number of streams in this account.',
                                                    'Account': 'Current account context.'
                                                }, links: {
                                                    'Cluster': 'https://docs.nats.io/using-nats/jetstream',
                                                    'Leader': 'https://docs.nats.io/using-nats/jetstream'
                                                } }), _jsxs("div", { className: "mt-2", children: [_jsx("button", { className: "button-ghost", onClick: () => setShowJszJSON(v => !v), children: showJszJSON ? 'Hide JSON' : 'Show JSON' }), showJszJSON && _jsx("div", { className: "mt-2", children: _jsx(Pre, { obj: jsz }) })] })] }), _jsxs(Section, { title: "Account", children: [_jsx("div", { className: "mb-2 text-sm text-gray-700", children: acct?.account_id || acct?.tier || '-' }), _jsx("button", { className: "button-ghost", onClick: () => setShowAcctJSON(v => !v), children: showAcctJSON ? 'Hide JSON' : 'Show JSON' }), showAcctJSON && _jsx("div", { className: "mt-2", children: _jsx(Pre, { obj: acct }) })] }), streamInfo && (_jsxs(Section, { title: "Messages", children: [_jsxs("div", { className: "flex items-end gap-2 flex-wrap", children: [_jsxs("label", { className: "text-sm text-gray-700", children: [_jsx("div", { className: "mb-1", children: "Sequence" }), _jsx("input", { className: "input w-40", inputMode: "numeric", placeholder: "e.g. 1", value: msgSeq, onChange: (e) => setMsgSeq(e.target.value) })] }), _jsx("button", { className: "button-primary", onClick: async () => {
                                                            if (!selectedStream)
                                                                return;
                                                            const n = Number(msgSeq);
                                                            if (!Number.isFinite(n) || n <= 0) {
                                                                setMsgErr('Invalid sequence');
                                                                return;
                                                            }
                                                            try {
                                                                setMsgLoading(true);
                                                                setMsgErr('');
                                                                const r = await jsGetMessage(selectedStream, { seq: n });
                                                                setMsg(r);
                                                                setMsgFromSeq(r?.meta?.seq ?? null);
                                                            }
                                                            catch (e) {
                                                                setMsg(null);
                                                                setMsgErr(e?.message || 'get message failed');
                                                            }
                                                            finally {
                                                                setMsgLoading(false);
                                                            }
                                                        }, children: "Get by Seq" }), _jsx("div", { className: "w-px h-8 bg-gray-200" }), _jsxs("label", { className: "text-sm text-gray-700", children: [_jsx("div", { className: "mb-1", children: "Subject" }), _jsx("input", { className: "input w-64", placeholder: "subject or wildcard", value: msgSubject, onChange: (e) => setMsgSubject(e.target.value) })] }), _jsx("button", { className: "button-primary", onClick: async () => {
                                                            if (!selectedStream || !msgSubject.trim())
                                                                return;
                                                            try {
                                                                setMsgLoading(true);
                                                                setMsgErr('');
                                                                const r = await jsGetMessage(selectedStream, { last_by_subj: msgSubject.trim() });
                                                                setMsg(r);
                                                                setMsgFromSeq(r?.meta?.seq ?? null);
                                                            }
                                                            catch (e) {
                                                                setMsg(null);
                                                                setMsgErr(e?.message || 'get last message failed');
                                                            }
                                                            finally {
                                                                setMsgLoading(false);
                                                            }
                                                        }, children: "Last by Subject" }), _jsx("button", { className: "button-primary", onClick: async () => {
                                                            if (!selectedStream || !msgSubject.trim())
                                                                return;
                                                            try {
                                                                setMsgLoading(true);
                                                                setMsgErr('');
                                                                const from = msgFromSeq && msgFromSeq > 0 ? msgFromSeq : undefined;
                                                                const r = await jsGetMessage(selectedStream, { next_by_subj: msgSubject.trim(), from });
                                                                setMsg(r);
                                                                setMsgFromSeq(r?.meta?.seq ?? null);
                                                            }
                                                            catch (e) {
                                                                setMsg(null);
                                                                setMsgErr(e?.message || 'get next message failed');
                                                            }
                                                            finally {
                                                                setMsgLoading(false);
                                                            }
                                                        }, children: "Next by Subject" })] }), _jsxs("div", { className: "mt-3", children: [msgLoading && _jsx("div", { className: "text-gray-500 text-sm", children: "Loading message..." }), msgErr && _jsx("div", { className: "text-red-600 text-sm", children: msgErr }), !msgLoading && !msgErr && msg && (_jsxs("div", { className: "space-y-2", children: [_jsx(KeyVals, { items: [
                                                                    ['Seq', msg?.meta?.seq],
                                                                    ['Subject', msg?.meta?.subject],
                                                                    ['Time', msg?.meta?.time],
                                                                    ['Size', msg?.meta?.size],
                                                                ] }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-700 mb-1", children: "Headers" }), _jsx(Pre, { obj: msg?.headers || {} })] }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-700 mb-1", children: "Body" }), msg?.json ? (_jsx(Pre, { obj: msg.json })) : msg?.data?.text ? (_jsx("pre", { className: "bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto", children: msg.data.text })) : (_jsxs("div", { className: "text-sm text-gray-500", children: ["Binary data (base64):", _jsx("div", { className: "mt-1 break-all text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded", children: msg?.data?.base64 || '-' })] }))] })] }))] })] }))] })] })] })), showCreateStream && (_jsxs(Modal, { title: "Create Stream", onClose: () => setShowCreateStream(false), children: [streamModalErr && _jsx("div", { className: "text-red-600 text-sm mb-2", children: streamModalErr }), _jsx("textarea", { className: "input w-full h-64 font-mono", value: streamJsonText, onChange: (e) => setStreamJsonText(e.target.value) }), _jsxs("div", { className: "mt-3 flex items-center gap-2 justify-end", children: [_jsx("button", { className: "button-ghost", onClick: () => setShowCreateStream(false), children: "Cancel" }), _jsx("button", { className: "button-primary", onClick: async () => {
                                    try {
                                        setStreamModalErr('');
                                        const cfg = JSON.parse(streamJsonText || '{}');
                                        if (!cfg?.name) {
                                            setStreamModalErr('name is required');
                                            return;
                                        }
                                        await jsStreamCreate(cfg);
                                        setShowCreateStream(false);
                                        setSelectedStream(cfg.name);
                                        await refreshAll();
                                    }
                                    catch (e) {
                                        setStreamModalErr(e?.message || 'create stream failed');
                                    }
                                }, children: "Create" })] })] })), showEditStream && (_jsxs(Modal, { title: `Edit Stream: ${selectedStream}`, onClose: () => setShowEditStream(false), children: [streamModalErr && _jsx("div", { className: "text-red-600 text-sm mb-2", children: streamModalErr }), _jsx("textarea", { className: "input w-full h-64 font-mono", value: streamJsonText, onChange: (e) => setStreamJsonText(e.target.value) }), _jsxs("div", { className: "mt-3 flex items-center gap-2 justify-end", children: [_jsx("button", { className: "button-ghost", onClick: () => setShowEditStream(false), children: "Cancel" }), _jsx("button", { className: "button-primary", onClick: async () => {
                                    if (!selectedStream)
                                        return;
                                    try {
                                        setStreamModalErr('');
                                        const cfg = JSON.parse(streamJsonText || '{}');
                                        await jsStreamUpdate(selectedStream, cfg);
                                        setShowEditStream(false);
                                        await refreshAll();
                                    }
                                    catch (e) {
                                        setStreamModalErr(e?.message || 'update stream failed');
                                    }
                                }, children: "Save" })] })] })), showCreateConsumer && (_jsxs(Modal, { title: `Create Consumer on ${selectedStream}`, onClose: () => setShowCreateConsumer(false), children: [consumerModalErr && _jsx("div", { className: "text-red-600 text-sm mb-2", children: consumerModalErr }), _jsx("textarea", { className: "input w-full h-64 font-mono", value: consumerJsonText, onChange: (e) => setConsumerJsonText(e.target.value) }), _jsxs("div", { className: "mt-3 flex items-center gap-2 justify-end", children: [_jsx("button", { className: "button-ghost", onClick: () => setShowCreateConsumer(false), children: "Cancel" }), _jsx("button", { className: "button-primary", onClick: async () => {
                                    if (!selectedStream)
                                        return;
                                    try {
                                        setConsumerModalErr('');
                                        const cfg = JSON.parse(consumerJsonText || '{}');
                                        const r = await jsConsumerCreate(selectedStream, cfg);
                                        setShowCreateConsumer(false);
                                        // refresh consumers list
                                        const cs = await jsConsumers(selectedStream);
                                        setConsumers(cs);
                                        const newName = r?.name || r?.config?.durable_name || cfg?.durable_name || '';
                                        setSelectedConsumer(newName || (cs[0]?.name || ''));
                                        await refreshAll();
                                    }
                                    catch (e) {
                                        setConsumerModalErr(e?.message || 'create consumer failed');
                                    }
                                }, children: "Create" })] })] })), showEditConsumer && (_jsxs(Modal, { title: `Edit Consumer: ${selectedConsumer}`, onClose: () => setShowEditConsumer(false), children: [consumerModalErr && _jsx("div", { className: "text-red-600 text-sm mb-2", children: consumerModalErr }), _jsx("textarea", { className: "input w-full h-64 font-mono", value: consumerJsonText, onChange: (e) => setConsumerJsonText(e.target.value) }), _jsxs("div", { className: "mt-3 flex items-center gap-2 justify-end", children: [_jsx("button", { className: "button-ghost", onClick: () => setShowEditConsumer(false), children: "Cancel" }), _jsx("button", { className: "button-primary", onClick: async () => {
                                    if (!selectedStream || !selectedConsumer)
                                        return;
                                    try {
                                        setConsumerModalErr('');
                                        const cfg = JSON.parse(consumerJsonText || '{}');
                                        await jsConsumerUpdate(selectedStream, selectedConsumer, cfg);
                                        setShowEditConsumer(false);
                                        // refresh consumer info
                                        const ci = await jsConsumerInfo(selectedStream, selectedConsumer);
                                        setConsumerInfo(ci);
                                    }
                                    catch (e) {
                                        setConsumerModalErr(e?.message || 'update consumer failed');
                                    }
                                }, children: "Save" })] })] }))] }));
}
function Section({ title, children, sticky }) {
    return (_jsxs("div", { className: `card ${sticky ? '' : 'overflow-hidden'} mb-3`, children: [_jsx("div", { className: `px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800 ${sticky ? 'sticky top-0 z-10' : ''}`, children: title }), _jsx("div", { className: "p-3", children: children })] }));
}
function KeyVals({ items, tips, links }) {
    return (_jsx("div", { className: "grid grid-cols-[160px_1fr] gap-x-3 gap-y-1.5 mb-2", children: items.map(([k, v]) => (_jsxs(React.Fragment, { children: [_jsxs("div", { className: "text-gray-600 flex items-center gap-1", children: [_jsx("span", { children: k }), (tips?.[k] || links?.[k]) && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] text-gray-500", children: [tips?.[k] && _jsx("span", { className: "cursor-help", title: tips[k], children: "?" }), links?.[k] && (_jsx("a", { href: links[k], target: "_blank", rel: "noreferrer", className: "underline hover:text-blue-600", children: "docs" }))] }))] }), _jsx("div", { children: String(v ?? '-') })] }, k))) }));
}
function Pre({ obj }) {
    if (!obj)
        return _jsx("div", { children: "-" });
    return _jsx("pre", { className: "bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto", children: JSON.stringify(obj, null, 2) });
}
function Modal({ title, children, onClose }) {
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: onClose }), _jsxs("div", { className: "relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-3", children: [_jsxs("div", { className: "px-4 py-2 border-b border-gray-200 dark:border-gray-800 font-semibold flex items-center justify-between", children: [_jsx("div", { children: title }), _jsx("button", { className: "text-sm text-gray-500 hover:text-gray-800", onClick: onClose, children: "\u2715" })] }), _jsx("div", { className: "p-4", children: children })] })] }));
}
// Tailwind styles used instead of inline styles
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
function fmtPct(used, max) {
    const u = Number(used || 0);
    const m = Number(max || 0);
    if (!isFinite(u) || u <= 0 || !isFinite(m) || m <= 0)
        return '-';
    return `${((u / m) * 100).toFixed(1)}%`;
}
function fmtDurationNs(x) {
    const n = Number(x || 0);
    if (!isFinite(n) || n <= 0)
        return '-';
    let ms = n / 1e6;
    const parts = [];
    const add = (v, suffix) => { if (v > 0)
        parts.push(`${Math.floor(v)}${suffix}`); };
    const d = Math.floor(ms / (24 * 3600 * 1000));
    ms -= d * 24 * 3600 * 1000;
    const h = Math.floor(ms / (3600 * 1000));
    ms -= h * 3600 * 1000;
    const m = Math.floor(ms / (60 * 1000));
    ms -= m * 60 * 1000;
    const s = Math.floor(ms / 1000);
    add(d, 'd');
    add(h, 'h');
    add(m, 'm');
    add(s, 's');
    return parts.length ? parts.join(' ') : '0s';
}
