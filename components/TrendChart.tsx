'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
} from 'recharts'
import { TrendPoint } from '@/types'

type Period = 'Auto' | 'Full' | '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y'

interface TrendChartProps {
  data: TrendPoint[]
  color: string
  mini?: boolean
}

const PERIODS: Period[] = ['Auto', 'Full', '1W', '1M', '3M', '6M', '1Y', '3Y']

function filterData(data: TrendPoint[], period: Period): TrendPoint[] {
  if (period === 'Full' || period === 'Auto') return data
  const days: Record<string, number> = {
    '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095,
  }
  const n = days[period] ?? data.length
  return data.slice(-n)
}

export default function TrendChart({ data, color, mini = false }: TrendChartProps) {
  const [period, setPeriod] = useState<Period>('1M')

  const filtered = filterData(data, period)

  // Show every Nth label to avoid crowding
  const step = Math.max(1, Math.floor(filtered.length / 6))
  const tickFormatter = (_: string, index: number) => {
    if (index % step !== 0) return ''
    return filtered[index]?.date ?? ''
  }

  if (mini) {
    return (
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={filtered} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Period selector */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
              period === p
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-700 border border-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f3f4f6"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
              formatter={(value: number | undefined) => [value != null ? value.toFixed(1) : '', 'Score']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#areaFill)"
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
