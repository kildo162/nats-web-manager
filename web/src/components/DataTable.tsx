import React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'

export type DataTableProps<T extends { [key: string]: any }> = {
  columns: ColumnDef<T, any>[]
  data: T[]
  pageSize?: number
  getRowId?: (row: T, index: number) => string
  renderDetail?: (row: T) => React.ReactNode
}

export default function DataTable<T extends { [key: string]: any }>(props: DataTableProps<T>) {
  const { columns, data, pageSize = 10, getRowId, renderDetail } = props
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({})

  const table = useReactTable<T>({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row, i) => (getRowId ? getRowId(row, i) : String(i)),
  })

  const rows = table.getRowModel().rows.slice(0, pageSize)

  return (
    <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead className="bg-gray-50 dark:bg-gray-950 sticky top-0 z-10">
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="text-gray-600 dark:text-gray-300">
              {hg.headers.map(h => (
                <th key={h.id} className="text-left px-3 py-2 select-none cursor-pointer border-b border-gray-200 dark:border-gray-800" onClick={h.column.getToggleSortingHandler()}>
                  <div className="inline-flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    <span className="text-xs text-gray-400">
                      {{ asc: '▲', desc: '▼' }[h.column.getIsSorted() as string] || ''}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map(r => {
            const isExpanded = !!expandedRows[r.id]
            return (
              <React.Fragment key={r.id}>
                <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${r.index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950'}`} onClick={() => {
                  if (!renderDetail) return
                  setExpandedRows(prev => ({ ...prev, [r.id]: !prev[r.id] }))
                }}>
                  {r.getVisibleCells().map(c => (
                    <td key={c.id} className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
                {renderDetail && isExpanded && (
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <td className="p-3" colSpan={r.getVisibleCells().length}>
                      {renderDetail(r.original as T)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
