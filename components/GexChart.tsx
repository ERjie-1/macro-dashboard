'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import type { TickerOptions } from '@/types/positioning'
import { formatB } from '@/lib/format'

interface Props {
  gex: TickerOptions['gex']
  spot: number
}

export default function GexChart({ gex, spot }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">GEX by Strike</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Total: <span className={`font-bold ${gex.total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatB(gex.total)}</span></span>
          {gex.flipPrice && <span>Flip: <span className="font-semibold text-gray-700">${gex.flipPrice}</span></span>}
        </div>
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={gex.byStrike} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <XAxis dataKey="strike" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip
              formatter={(value: number | undefined) => [formatB(value ?? 0), 'GEX']}
              labelFormatter={(label) => `Strike: $${label}`}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            {gex.flipPrice && <ReferenceLine x={gex.flipPrice} stroke="#6366f1" strokeDasharray="4 4" label={{ value: 'Flip', fontSize: 10 }} />}
            <Bar dataKey="gex" radius={[2, 2, 0, 0]}>
              {gex.byStrike.map((entry, i) => (
                <Cell key={i} fill={entry.gex >= 0 ? '#14b8a6' : '#ef4444'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
