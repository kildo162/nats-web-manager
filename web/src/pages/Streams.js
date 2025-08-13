import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { jsStreams, jsStreamInfo } from '../api';
export default function Streams() {
    const [streams, setStreams] = useState([]);
    const [selected, setSelected] = useState('');
    const [info, setInfo] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        ;
        (async () => {
            try {
                const s = await jsStreams();
                setStreams(s);
                if (s[0]?.config?.name) {
                    setSelected(s[0].config.name);
                }
            }
            catch (e) {
                setErr(e?.message || 'failed to load streams');
            }
        })();
    }, []);
    useEffect(() => {
        if (!selected)
            return;
        setLoading(true);
        jsStreamInfo(selected).then(setInfo).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    }, [selected]);
    return (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800 mb-3", children: "Streams" }), err && _jsx("div", { className: "text-red-600 text-sm mb-2", children: err }), _jsxs("div", { className: "grid grid-cols-[260px_1fr] gap-3", children: [_jsxs("div", { className: "card overflow-hidden", children: [_jsx("div", { className: "px-3 py-2 font-semibold text-gray-800 bg-gray-50 border-b border-gray-200 dark:bg-gray-950 dark:border-gray-800", children: "Streams" }), _jsxs("div", { className: "max-h-96 overflow-auto", children: [streams.map((s) => (_jsx("div", { onClick: () => setSelected(s.config.name), className: `px-3 py-2 cursor-pointer ${selected === s.config.name ? 'bg-blue-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900'}`, children: s.config.name }, s.config.name))), streams.length === 0 && _jsx("div", { className: "p-3 text-gray-500", children: "No streams" })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [_jsx("div", { className: "font-semibold text-gray-700", children: "Selected:" }), _jsx("div", { children: selected || '-' })] }), loading ? (_jsx("div", { className: "text-gray-500", children: "Loading stream info..." })) : info ? (_jsx("pre", { className: "bg-gray-900 text-gray-100 text-sm rounded-lg p-4 overflow-auto", children: JSON.stringify(info, null, 2) })) : (_jsx("div", { className: "text-gray-500", children: "Select a stream" }))] })] })] }));
}
