'use client'

import { useState } from 'react'
import type { TickerOptions } from '@/types/positioning'
import GexChart from './GexChart'
import OptionsMetrics from './OptionsMetrics'
import KeyLevels from './KeyLevels'

interface Props {
  options: Record<string, TickerOptions>
}

const TICKERS = ['SPY', 'QQQ', 'IWM']

export default function OptionsSection({ options }: Props) {
  const available = TICKERS.filter((t) => t in options)
  const [active, setActive] = useState(available[0] || 'SPY')

  if (available.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-800">Options Structure</h2>
        <p className="text-gray-500 mt-2">No options data available.</p>
      </div>
    )
  }

  const data = options[active]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Options Structure</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {available.map((ticker) => (
            <button
              key={ticker}
              onClick={() => setActive(ticker)}
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

      <div className="space-y-5">
        {/* Metrics Grid */}
        <OptionsMetrics data={data} />

        {/* GEX Chart + Key Levels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <GexChart gex={data.gex} spot={data.spot} />
          </div>
          <div>
            <KeyLevels data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}
