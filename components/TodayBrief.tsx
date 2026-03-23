'use client'

import { useState } from 'react'
import type { MacroDashboard, Module } from '@/types'

interface Props {
  data: MacroDashboard
  delta1D: number
  delta7D: number
}

export default function TodayBrief({ data, delta1D, delta7D }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Find biggest 1D movers (approximate from module score - prevScore)
  const moduleDeltas = data.modules
    .map((m) => ({ name: m.name, delta: m.score - m.prevScore }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const biggestUp = moduleDeltas.find((m) => m.delta > 0)
  const biggestDown = moduleDeltas.find((m) => m.delta < 0)

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Today Brief</h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{dateStr}</span>
          <span className={`font-medium ${Math.abs(delta1D) < 0.3 ? 'text-gray-400' : delta1D >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            1D {Math.abs(delta1D) < 0.3 ? 'n.s.' : `${delta1D >= 0 ? '+' : ''}${delta1D.toFixed(1)}`}
          </span>
        </div>
      </div>

      {/* Score deltas */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-sm">
        <div>
          <span className="text-gray-500">MEC总分变动:</span>{' '}
          <span className={`font-medium ${delta1D >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            1D {delta1D >= 0 ? '+' : ''}{delta1D.toFixed(1)} pts
          </span>{' '}
          <span className={`font-medium ${delta7D >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            7D {delta7D >= 0 ? '+' : ''}{delta7D.toFixed(1)} pts
          </span>
        </div>
      </div>

      {/* Biggest module movers */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 mb-4 text-sm">
        {biggestUp && (
          <div>
            <span className="text-gray-500">1D最大变动模块:</span>{' '}
            <span className="font-medium text-green-600">
              {biggestUp.name} {biggestUp.delta >= 0 ? '+' : ''}{biggestUp.delta.toFixed(1)} pts
            </span>
          </div>
        )}
        {biggestDown && (
          <div>
            <span className="text-gray-500">1D最大跌幅:</span>{' '}
            <span className="font-medium text-red-500">
              {biggestDown.name} {biggestDown.delta.toFixed(1)} pts
            </span>
          </div>
        )}
      </div>

      <hr className="border-gray-100 mb-4" />

      {/* AI narrative placeholder */}
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">
        <p>
          今日宏观环境总分{delta1D >= 0 ? '小幅回升' : '继续承压'}，
          供给侧压力{biggestDown ? `主要来自${biggestDown.name}模块` : '相对均衡'}。
          {biggestUp ? `${biggestUp.name}模块有所改善，` : ''}
          短期趋势需要关注流动性和利率变化的方向。
        </p>
        {expanded && (
          <p>
            当前处于5年{data.percentile5Y}百分位，表明整体环境处于历史中等偏{data.percentile5Y > 50 ? '好' : '差'}水平。
            市场定价反映出投资者对宏观前景的{data.score > 50 ? '相对乐观' : '谨慎'}态度。
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {expanded ? '收起展望' : '未来展望'}
        </button>
        <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          ↑7D变化
        </button>
        <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          主要 Drivers
        </button>
      </div>
    </div>
  )
}
