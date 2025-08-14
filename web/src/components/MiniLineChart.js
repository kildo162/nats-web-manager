import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
export default function MiniLineChart(props) {
    const { data, color = '#0ea5e9', height = 60, format } = props;
    const series = Array.isArray(data) ? data.map((v, i) => ({ i, v })) : [];
    return (_jsx("div", { style: { width: '100%', height }, children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: series, margin: { top: 4, right: 6, bottom: 0, left: 0 }, children: [_jsx(Tooltip, { isAnimationActive: false, formatter: (val) => (typeof val === 'number' ? (format ? format(val) : String(val)) : val), labelFormatter: () => '' }), _jsx(Line, { type: "monotone", dataKey: "v", stroke: color, strokeWidth: 2, dot: false, isAnimationActive: false })] }) }) }));
}
