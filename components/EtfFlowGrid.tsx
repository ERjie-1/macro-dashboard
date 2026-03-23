'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import type { EtfFlow } from '@/types/positioning'

interface Props {
  flows: Record<string, EtfFlow>
}

const ORDER = ['SPY', 'QQQ', 'IWM', 'TLT', 'HYG', 'LQD', 'GLD']

function getMfiColor(mfi: number): string {
  if (mfi >= 70) return '#14b8a6'  // overbought
  if (mfi >= 50) return '#22c55e'
  if (mfi >= 30) return '#f97316'
  return '#ef4444'                  // oversold
}

function FlowCard({ ticker, flow }: { ticker: string; flow: EtfFlow }) {
  const mfiColor = getMfiColor(flow.mfi14)
  const obvTrend = flow.history30D.length >= 2
    ? flow.history30D[flow.history30D.length - 1].obv - flow.history30D[0].obv
    : 0
  const obvColor = obvTrend >= 0 ? '#14b8a6' : '#ef4444'

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-800">{ticker}</span>
        <span className="text-xs text-gray-500">Vol: {flow.volumeVsAvg.toFixed(2)}x avg</span>
      </div>

      {/* Sparkline */}
      <div style={{ height: 50 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={flow.history30D} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Area type="monotone" dataKey="mfi" stroke={mfiColor} fill={mfiColor} fillOpacity={0.1} strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between mt-2 text-xs">
        <span className="text-gray-500">MFI: <span className="font-semibold" style={{ color: mfiColor }}>{flow.mfi14.toFixed(1)}</span></span>
        <span className="text-gray-500">OBV: <span className="font-semibold" style={{ color: obvColor }}>
          {flow.obv >= 0 ? '+' : ''}{(flow.obv / 1e6).toFixed(0)}M
        </span></span>
      </div>
    </div>
  )
}

export default function EtfFlowGrid({ flows }: Props) {
  const orderedTickers = ORDER.filter((t) => t in flows)

  if (orderedTickers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-800">ETF Fund Flows</h2>
        <p className="text-gray-500 mt-2">No flow data available.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">ETF Fund Flows (Proxy)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {orderedTickers.map((ticker) => (
          <FlowCard key={ticker} ticker={ticker} flow={flows[ticker]} />
        ))}
      </div>
    </div>
  )
}
