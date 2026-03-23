'use client'

import { useState } from 'react'
import type { Factor, Status } from '@/types'
import FactorTable from './FactorTable'

interface Props {
  factors: Factor[]
  moduleColor: string
}

type FilterType = 'all' | Status

export default function ModuleFactorsSection({ factors, moduleColor }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const scored = factors.filter((f) => !f.isExtra)
  const supportive = scored.filter((f) => f.status === 'supportive').length
  const neutral = scored.filter((f) => f.status === 'neutral').length
  const restrictive = scored.filter((f) => f.status === 'restrictive').length

  const filtered = filter === 'all'
    ? factors
    : factors.filter((f) => f.status === filter || f.isExtra)

  const cards: { key: FilterType; label: string; count: number; color: string; activeColor: string }[] = [
    { key: 'supportive', label: 'Supportive', count: supportive, color: 'text-green-500', activeColor: 'border-green-500 bg-green-50' },
    { key: 'neutral', label: 'Neutral', count: neutral, color: 'text-orange-400', activeColor: 'border-orange-400 bg-orange-50' },
    { key: 'restrictive', label: 'Restrictive', count: restrictive, color: 'text-red-500', activeColor: 'border-red-500 bg-red-50' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter cards */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Factors Overview</h3>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Show all
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
              className={`border rounded-lg p-4 text-center transition-colors ${
                filter === c.key ? c.activeColor : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`text-2xl font-bold ${c.color}`}>{c.count}</div>
              <div className="text-xs text-gray-400 mt-1 tracking-wide uppercase">{c.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Filtered factor table */}
      <FactorTable
        factors={filtered}
        title={filter === 'all' ? 'Scored Factors' : `Scored Factors — ${filter}`}
        moduleColor={moduleColor}
      />
    </div>
  )
}
