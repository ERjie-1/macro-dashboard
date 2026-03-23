'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import type { TickerOptions } from '@/types/positioning'

interface Props {
  skew: TickerOptions['skew']
}

export default function SkewChart({ skew }: Props) {
  const data = [
    { name: 'Put 25Δ', iv: skew.putIV25d, fill: '#ef4444' },
    { name: 'Call 25Δ', iv: skew.callIV25d, fill: '#14b8a6' },
  ]

  const rr = skew.riskReversal25d
  const rrColor = rr >= 0 ? '#ef4444' : '#14b8a6'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">25Δ Skew</h3>
        <span className="text-xs">
          Risk Reversal:{' '}
          <span className="font-bold" style={{ color: rrColor }}>
            {rr >= 0 ? '+' : ''}{rr.toFixed(1)}
          </span>
        </span>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 60, bottom: 4 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
            <Tooltip formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'IV']} />
            <ReferenceLine x={skew.atmIV} stroke="#6366f1" strokeDasharray="4 4" label={{ value: `ATM ${skew.atmIV.toFixed(1)}%`, fontSize: 9, fill: '#6366f1' }} />
            <Bar dataKey="iv" barSize={20} radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
