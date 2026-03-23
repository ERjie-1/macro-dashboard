'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import type { VixTermStructure, SkewIndex } from '@/types/positioning'

interface Props {
  vixData: VixTermStructure
  skewData: SkewIndex
}

export default function VixCurve({ vixData, skewData }: Props) {
  const shapeLabel = vixData.shape === 'backwardation'
    ? 'Backwardation'
    : vixData.shape === 'contango'
    ? 'Contango'
    : 'Mixed'

  const shapeColor = vixData.shape === 'backwardation' ? '#ef4444' : vixData.shape === 'contango' ? '#14b8a6' : '#f97316'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">VIX Term Structure</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="px-2 py-0.5 rounded text-white font-medium" style={{ backgroundColor: shapeColor }}>
            {shapeLabel}
          </span>
          <span className="text-gray-500">VIX 1Y Pctl: <span className="font-semibold text-gray-800">{vixData.vixPercentile1Y}%</span></span>
          {skewData.current > 0 && (
            <span className="text-gray-500">SKEW: <span className="font-semibold text-gray-800">{skewData.current}</span></span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Term Structure Curve */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Current Curve</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vixData.points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <XAxis dataKey="tenor" tick={{ fontSize: 12 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* VIX vs VIX3M History */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">VIX vs VIX3M (90D)</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vixData.history90D} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={14} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="vix3m" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeWidth={1.5} name="VIX3M" dot={false} />
                <Area type="monotone" dataKey="vix" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} name="VIX" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
