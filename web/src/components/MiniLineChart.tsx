import React from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

export default function MiniLineChart(props: { data: number[]; color?: string; height?: number; format?: (v: number) => string }) {
  const { data, color = '#0ea5e9', height = 60, format } = props
  const series = Array.isArray(data) ? data.map((v, i) => ({ i, v })) : []
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
          <Tooltip
            isAnimationActive={false}
            formatter={(val: any) => (typeof val === 'number' ? (format ? format(val) : String(val)) : val)}
            labelFormatter={() => ''}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
