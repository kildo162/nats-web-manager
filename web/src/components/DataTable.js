import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, } from '@tanstack/react-table';
export default function DataTable(props) {
    const { columns, data, pageSize = 10, getRowId, renderDetail } = props;
    const [sorting, setSorting] = React.useState([]);
    const [expandedRows, setExpandedRows] = React.useState({});
    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: (row, i) => (getRowId ? getRowId(row, i) : String(i)),
    });
    const rows = table.getRowModel().rows.slice(0, pageSize);
    return (_jsx("div", { className: "overflow-auto rounded-lg border border-gray-200 dark:border-gray-800", children: _jsxs("table", { className: "min-w-full text-sm border-separate border-spacing-0", children: [_jsx("thead", { className: "bg-gray-50 dark:bg-gray-950 sticky top-0 z-10", children: table.getHeaderGroups().map(hg => (_jsx("tr", { className: "text-gray-600 dark:text-gray-300", children: hg.headers.map(h => (_jsx("th", { className: "text-left px-3 py-2 select-none cursor-pointer border-b border-gray-200 dark:border-gray-800", onClick: h.column.getToggleSortingHandler(), children: _jsxs("div", { className: "inline-flex items-center gap-1", children: [flexRender(h.column.columnDef.header, h.getContext()), _jsx("span", { className: "text-xs text-gray-400", children: { asc: '▲', desc: '▼' }[h.column.getIsSorted()] || '' })] }) }, h.id))) }, hg.id))) }), _jsx("tbody", { children: rows.map(r => {
                        const isExpanded = !!expandedRows[r.id];
                        return (_jsxs(React.Fragment, { children: [_jsx("tr", { className: `hover:bg-gray-50 dark:hover:bg-gray-800 ${r.index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950'}`, onClick: () => {
                                        if (!renderDetail)
                                            return;
                                        setExpandedRows(prev => ({ ...prev, [r.id]: !prev[r.id] }));
                                    }, children: r.getVisibleCells().map(c => (_jsx("td", { className: "px-3 py-2 border-b border-gray-100 dark:border-gray-800", children: flexRender(c.column.columnDef.cell, c.getContext()) }, c.id))) }), renderDetail && isExpanded && (_jsx("tr", { className: "bg-gray-50 dark:bg-gray-900", children: _jsx("td", { className: "p-3", colSpan: r.getVisibleCells().length, children: renderDetail(r.original) }) }))] }, r.id));
                    }) })] }) }));
}
