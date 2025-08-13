import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function AutoRefreshDialog({ open, onClose, onSaved }) {
    const [seconds, setSeconds] = useState(5);
    const [autoDefault, setAutoDefault] = useState(false);
    useEffect(() => {
        if (!open)
            return;
        try {
            const ms = Number(localStorage.getItem('refresh_interval_ms') || 5000);
            setSeconds(Math.max(1, Math.round(ms / 1000)));
        }
        catch { }
        try {
            setAutoDefault(localStorage.getItem('auto_refresh') === '1');
        }
        catch { }
    }, [open]);
    const save = () => {
        try {
            localStorage.setItem('refresh_interval_ms', String(Math.max(1000, seconds * 1000)));
        }
        catch { }
        try {
            localStorage.setItem('auto_refresh', autoDefault ? '1' : '0');
        }
        catch { }
        onSaved && onSaved();
        onClose();
    };
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [_jsx("div", { className: "absolute inset-0 bg-black/50", onClick: onClose }), _jsxs("div", { className: "relative bg-white dark:bg-gray-950 rounded-lg shadow-xl w-full max-w-md p-4 border border-gray-200 dark:border-gray-800", children: [_jsx("div", { className: "text-lg font-semibold mb-3 text-gray-800", children: "Auto Refresh Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("label", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-gray-700", children: "Interval (seconds)" }), _jsx("input", { type: "number", min: 1, className: "input w-28", value: seconds, onChange: (e) => setSeconds(Number(e.target.value)) })] }), _jsxs("label", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-gray-700", children: "Default Auto Refresh" }), _jsx("input", { type: "checkbox", checked: autoDefault, onChange: (e) => setAutoDefault(e.target.checked) })] })] }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx("button", { className: "button", onClick: onClose, children: "Cancel" }), _jsx("button", { className: "button-primary", onClick: save, children: "Save" })] })] })] }));
}
