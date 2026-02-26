'use client'

import { useState } from 'react'
import { LiftDragItem } from '@/types'

interface ScoreLiftDragProps {
  lift: LiftDragItem[]
  drag: LiftDragItem[]
}

export default function ScoreLiftDrag({ lift, drag }: ScoreLiftDragProps) {
  const [period, setPeriod] = useState<'1D' | '7D'>('7D')
  const SHOW = 3

  const liftItems = lift.slice(0, SHOW)
  const dragItems = drag.slice(0, SHOW)
  const liftOther = lift.length - SHOW
  const dragOther = drag.length - SHOW

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Top Score Lift / Drag{' '}
          <span className="text-gray-400 font-normal">({period})</span>
        </h3>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(['1D', '7D'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Score Lift */}
        <div>
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
            Score Lift
          </div>
          <div className="space-y-2">
            {liftItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.name}</span>
                <span className="text-sm font-medium text-green-500">
                  ▲ {item.pts.toFixed(1)} pts
                </span>
              </div>
            ))}
            {liftOther > 0 && (
              <div className="text-xs text-gray-400 pt-1">+ {liftOther} other factors</div>
            )}
          </div>
        </div>

        {/* Score Drag */}
        <div>
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
            Score Drag
          </div>
          <div className="space-y-2">
            {dragItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.name}</span>
                <span className="text-sm font-medium text-red-500">
                  ▼ {Math.abs(item.pts).toFixed(1)} pts
                </span>
              </div>
            ))}
            {dragOther > 0 && (
              <div className="text-xs text-gray-400 pt-1">+ {dragOther} other factors</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Attribution is approximate and may not sum to exact score change.
        </p>
      </div>
    </div>
  )
}
