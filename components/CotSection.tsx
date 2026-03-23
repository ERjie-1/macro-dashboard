'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { CotData, CotContract } from '@/types/positioning'

interface Props {
  cot: CotData
}

const CATEGORIES = [
  { key: 'equity', label: 'Equity' },
  { key: 'bond', label: 'Bonds' },
  { key: 'commodity', label: 'Commodities' },
  { key: 'fx', label: 'FX' },
] as const

function ContractCard({ symbol, contract }: { symbol: string; contract: CotContract }) {
  const hasHistory = contract.history.length > 0
  const chgColor = contract.leveragedNetChg >= 0 ? 'text-emerald-600' : 'text-red-500'

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-semibold text-gray-800">{symbol}</span>
          <span className="text-xs text-gray-500 ml-2">{contract.name}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-gray-800">{contract.leveragedNet.toLocaleString()}</div>
          <div className={`text-xs font-medium ${chgColor}`}>
            {contract.leveragedNetChg >= 0 ? '+' : ''}{contract.leveragedNetChg.toLocaleString()} wk
          </div>
        </div>
      </div>

      {hasHistory && (
        <div style={{ height: 100 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={contract.history} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <XAxis dataKey="date" tick={false} />
              <YAxis domain={['auto', 'auto']} tick={false} />
              <Tooltip
                labelFormatter={(label) => `Week: ${label}`}
                formatter={(value: number) => [value.toLocaleString(), 'Leveraged Net']}
              />
              <Area
                type="monotone"
                dataKey="leveragedNet"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.1}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!hasHistory && (
        <div className="text-xs text-gray-400 text-center py-4">No history data</div>
      )}

      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>Asset Mgr: {contract.assetMgrNet.toLocaleString()}</span>
        <span>Dealer: {contract.dealerNet.toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function CotSection({ cot }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('equity')

  const contracts = Object.entries(cot.contracts).filter(
    ([, c]) => c.category === activeCategory
  )

  const hasData = Object.values(cot.contracts).some((c) => c.leveragedNet !== 0 || c.history.length > 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">CFTC Positioning</h2>
          {cot.asOfDate && <span className="text-xs text-gray-500">As of {cot.asOfDate}</span>}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeCategory === cat.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-gray-500 text-sm">COT data not yet available. CFTC reports are published weekly on Fridays.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contracts.map(([symbol, contract]) => (
            <ContractCard key={symbol} symbol={symbol} contract={contract} />
          ))}
        </div>
      )}
    </div>
  )
}
