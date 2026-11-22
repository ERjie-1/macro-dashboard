'use client'

import { useState } from 'react'
import type { TickerOptions } from '@/types/positioning'
import GexChart from './GexChart'
import OptionsMetrics from './OptionsMetrics'
import KeyLevels from './KeyLevels'
import SkewChart from './SkewChart'
import PositioningReading from './PositioningReading'
import { expiryRows } from '@/lib/positioningReading'

interface Props {
  options: Record<string, TickerOptions>
  asOf?: string
}

const TICKERS = ['SPY', 'QQQ', 'IWM']
const CONTENT_TABS = [
  { key: 'structure' as const, label: 'Structure' },
  { key: 'volatility' as const, label: 'Volatility' },
]

export default function OptionsSection({ options, asOf }: Props) {
  const available = TICKERS.filter((t) => t in options)
  const [active, setActive] = useState(available[0] || 'SPY')
  const [chosenExpiry, setChosenExpiry] = useState('')
  const [contentTab, setContentTab] = useState<'structure' | 'volatility'>('structure')

  if (available.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-800">Options Structure</h2>
        <p className="text-gray-500 mt-2">No options data available.</p>
      </div>
    )
  }

  const data = options[active]
  const rows = expiryRows(data, asOf)
  const selectedExpiry = rows.some(x => x.expiry === chosenExpiry) ? chosenExpiry : data.pcr.targetExpiry || rows[0]?.expiry || ''

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Options & Volatility</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {available.map((ticker) => (
            <button
              key={ticker}
              onClick={() => { setActive(ticker); setChosenExpiry('') }}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                active === ticker
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {ticker}
            </button>
          ))}
        </div>
      </div>

      {/* Content tabs (second layer) */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-4 w-fit">
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setContentTab(tab.key)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              contentTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* Metrics Grid */}
        <OptionsMetrics data={data} tab={contentTab} />

        {contentTab === 'structure' && <PositioningReading data={data} asOf={asOf} selectedExpiry={selectedExpiry} />}
        {/* Tab-specific content */}
        {contentTab === 'structure' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <GexChart gex={data.gex} spot={data.spot} asOf={asOf} selectedExpiry={selectedExpiry} onSelectExpiry={setChosenExpiry} />
            </div>
            <div>
              <KeyLevels data={data} selectedExpiry={selectedExpiry} />
            </div>
          </div>
        ) : (
          <SkewChart skew={data.skew} />
        )}
      </div>
    </div>
  )
}
