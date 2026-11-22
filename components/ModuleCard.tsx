import { displayScore } from '@/lib/scoreMetrics'
import Link from 'next/link'
import { Module } from '@/types'
import { getScoreColor } from '@/lib/getData'
import { computeSeriesDeltas } from '@/lib/scoreMetrics'

interface ModuleCardProps {
  module: Module
  asOfTradingDate?: string
}

export default function ModuleCard({ module, asOfTradingDate }: ModuleCardProps) {
  const color = getScoreColor(module.score)

  const { delta7D, prev7DDate } = computeSeriesDeltas(
    module.score,
    module.trendData,
    asOfTradingDate,
    module.prevScore
  )
  const changeStr = `${delta7D >= 0 ? '+' : ''}${displayScore(delta7D)} pts`
  const changeColor = delta7D > 0.05
    ? 'text-green-600'
    : delta7D < -0.05
      ? 'text-red-600'
      : 'text-gray-400'

  const liftCount = module.factors.filter(f => !f.isExtra && f.changeDirection === 'up').length
  const dragCount = module.factors.filter(f => !f.isExtra && f.changeDirection === 'down').length

  return (
    <Link
      href={`/module/${module.slug}`}
      className="px-4 py-4 text-center hover:bg-gray-50 transition-colors group"
    >
      <div className="mb-3 min-h-[2.25rem] flex items-center justify-center px-2">
        <div className="text-sm font-medium text-center text-gray-400 group-hover:text-gray-700 transition-colors leading-snug">
          {module.name}
        </div>
      </div>

      <div
        className="font-mono text-[1.75rem] leading-none mb-3"
        style={{ color }}
      >
        {module.score.toFixed(1)}
      </div>

      <div
        className={`text-sm font-mono ${changeColor}`}
        title={prev7DDate ? `7D vs ${prev7DDate}` : undefined}
      >
        {changeStr}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] font-medium">
        {liftCount > 0 && (
          <span className="text-green-600">{liftCount}▲</span>
        )}
        {dragCount > 0 && (
          <span className="text-red-600">{dragCount}▼</span>
        )}
        {liftCount === 0 && dragCount === 0 && (
          <span className="text-gray-300">—</span>
        )}
      </div>
    </Link>
  )
}
