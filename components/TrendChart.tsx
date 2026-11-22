'use client'

import { useState } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
} from 'recharts'
import { TrendPoint } from '@/types'
import { formatShortMonthDay } from '@/lib/scoreMetrics'

type ScaleMode = 'Auto' | 'Full'
type RangePeriod = '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y'

interface TrendChartProps {
  data: TrendPoint[]
  color?: string
  mini?: boolean
  title?: string
  asOfTradingDate?: string
}

const RANGES: RangePeriod[] = ['1W', '1M', '3M', '6M', '1Y', '3Y']

const TRADING_DAYS_BY_RANGE: Record<RangePeriod, number> = {
  '1W': 6,
  '1M': 22,
  '3M': 65,
  '6M': 130,
  '1Y': 252,
  '3Y': 756,
}

function filterData(data: TrendPoint[], range: RangePeriod): TrendPoint[] {
  const n = TRADING_DAYS_BY_RANGE[range] ?? data.length
  return data.slice(-n)
}

function computeAutoDomain(points: TrendPoint[]): [number, number] {
  if (points.length === 0) return [0, 100]
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    if (p.value < min) min = p.value
    if (p.value > max) max = p.value
  }
  const span = Math.max(4, max - min)
  const pad = Math.max(2, span * 0.16)
  const lo = Math.max(0, Math.floor(min - pad))
  const hi = Math.min(100, Math.ceil(max + pad))
  return [lo, hi > lo ? hi : Math.min(100, lo + 5)]
}

export default function TrendChart({
  data,
  color = '#1f2937',
  mini = false,
  title,
  asOfTradingDate,
}: TrendChartProps) {
  const [scaleMode, setScaleMode] = useState<ScaleMode>('Auto')
  const [range, setRange] = useState<RangePeriod>('1M')

  const filtered = filterData(data, range)
  const yDomain: [number, number] = scaleMode === 'Auto' ? computeAutoDomain(filtered) : [0, 100]

  // Evenly space ~6 X-axis ticks including the latest point
  const n = filtered.length
  const tickIndices = new Set<number>()
  if (n > 0) {
    tickIndices.add(0)
    tickIndices.add(n - 1)
    const desired = Math.min(6, n)
    if (desired > 2) {
      for (let i = 1; i < desired - 1; i++) {
        tickIndices.add(Math.round((i * (n - 1)) / (desired - 1)))
      }
    }
  }

  const tickFormatter = (val: string, index: number) => {
    if (!tickIndices.has(index)) return ''
    return formatShortMonthDay(val, asOfTradingDate)
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
      {/* Header row: optional title + Auto/Full | Range selector */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap xl:flex-nowrap">
        {title && (
          <h2 className="text-base font-semibold text-gray-900 whitespace-nowrap">{title}</h2>
        )}
        <div className="flex items-center gap-1 flex-wrap ml-auto">
          {(['Auto', 'Full'] as ScaleMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setScaleMode(mode)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                scaleMode === mode
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {mode}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              disabled={data.length < TRADING_DAYS_BY_RANGE[r]}
              title={data.length < TRADING_DAYS_BY_RANGE[r] ? `Only ${data.length} trading-day observations available` : undefined}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                range === r
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2">{filtered[0]?.date} – {filtered.at(-1)?.date} · {filtered.length} trading-day observations</p>

      {/* Chart */}
      <div className="flex-1 min-h-[220px] border border-gray-200 rounded-sm">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              horizontal={true}
              vertical={true}
            />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
              tickLine={false}
              interval={0}
              dy={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
              tickLine={false}
              width={34}
              domain={yDomain}
              tickCount={5}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: 2 }}
              labelFormatter={(label) => formatShortMonthDay(String(label), asOfTradingDate)}
              formatter={(value: number | undefined) => [
                value != null ? value.toFixed(1) : '',
                'MEC Score',
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1f2937"
              strokeWidth={1.65}
              dot={false}
              activeDot={{ r: 3.5, fill: '#111827', stroke: '#ffffff', strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
