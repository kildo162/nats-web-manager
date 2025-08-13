import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { publish, subscribe } from '../api';
export default function PubSub() {
    // Publish state
    const [pubSubject, setPubSubject] = useState('demo.hello');
    const [payload, setPayload] = useState('{"msg":"hello"}');
    const [pubResp, setPubResp] = useState('');
    // Subscribe state
    const [subSubject, setSubSubject] = useState('demo.>');
    const [active, setActive] = useState(false);
    const [messages, setMessages] = useState([]);
    const unsubRef = useRef(null);
    useEffect(() => () => { if (unsubRef.current)
        unsubRef.current(); }, []);
    async function doPublish() {
        try {
            const data = JSON.parse(payload);
            await publish(pubSubject, data);
            setPubResp('Published');
        }
        catch (e) {
            setPubResp(`Error: ${e.message}`);
        }
        setTimeout(() => setPubResp(''), 1500);
    }
    function toggleSub() {
        if (active) {
            unsubRef.current?.();
            unsubRef.current = null;
            setActive(false);
        }
        else {
            setMessages([]);
            unsubRef.current = subscribe(subSubject, (evt) => {
                setMessages(prev => [evt, ...prev].slice(0, 200));
            });
            setActive(true);
        }
    }
    return (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-gray-800 mb-3", children: "Pub/Sub Console" }), _jsxs("section", { className: "space-y-2 mb-4", children: [_jsx("h3", { className: "text-base font-medium text-gray-700", children: "Publish" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "w-[70px] text-sm text-gray-600", children: "Subject" }), _jsx("input", { value: pubSubject, onChange: e => setPubSubject(e.target.value), className: "flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" }), _jsx("button", { onClick: doPublish, className: "button-primary", children: "Publish" }), _jsx("span", { className: pubResp.startsWith('Error') ? 'text-red-600 text-sm' : 'text-green-600 text-sm', children: pubResp })] }), _jsx("textarea", { value: payload, onChange: e => setPayload(e.target.value), rows: 6, className: "w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand" })] }), _jsxs("section", { className: "space-y-2", children: [_jsx("h3", { className: "text-base font-medium text-gray-700", children: "Subscribe" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "w-[70px] text-sm text-gray-600", children: "Subject" }), _jsx("input", { value: subSubject, onChange: e => setSubSubject(e.target.value), className: "flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" }), _jsx("button", { onClick: toggleSub, className: "button", children: active ? 'Stop' : 'Start' })] }), _jsxs("div", { className: "card p-3 max-h-80 overflow-auto", children: [messages.map((m, i) => (_jsxs("div", { className: "border-b border-gray-100 dark:border-gray-800 py-2", children: [_jsx("div", { className: "text-gray-600 text-sm", children: m.subject }), _jsx("pre", { className: "m-0 bg-gray-900 text-gray-100 text-sm rounded-md p-2 overflow-auto", children: JSON.stringify(m.data, null, 2) })] }, i))), messages.length === 0 && _jsx("div", { className: "text-gray-500", children: "No messages" })] })] })] }));
}
