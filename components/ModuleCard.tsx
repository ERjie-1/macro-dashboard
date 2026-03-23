import Link from 'next/link'
import { Module } from '@/types'
import { getScoreColor } from '@/lib/getData'

interface ModuleCardProps {
  module: Module
}

export default function ModuleCard({ module }: ModuleCardProps) {
  const color = getScoreColor(module.score)

  // 7D pts change (from trendData if available, else from prevScore)
  const len = module.trendData.length
  const sevenDayPts = len >= 7
    ? module.score - module.trendData[len - 7].value
    : module.score - module.prevScore
  const changeStr = `${sevenDayPts >= 0 ? '+' : ''}${sevenDayPts.toFixed(1)} pts`
  const changeColor = sevenDayPts > 0.05
    ? 'text-green-600'
    : sevenDayPts < -0.05
      ? 'text-red-600'
      : 'text-gray-400'

  // Lift/drag factor counts
  const liftCount = module.factors.filter(f => !f.isExtra && f.changeDirection === 'up').length
  const dragCount = module.factors.filter(f => !f.isExtra && f.changeDirection === 'down').length

  return (
    <Link
      href={`/module/${module.slug}`}
      className="px-4 py-4 text-center hover:bg-gray-50 transition-colors group"
    >
      {/* Module name */}
      <div className="mb-3 min-h-[2.25rem] flex items-center justify-center px-2">
        <div className="text-sm font-medium text-center text-gray-400 group-hover:text-gray-700 transition-colors leading-snug">
          {module.name}
        </div>
      </div>

      {/* Score */}
      <div
        className="font-mono text-[1.75rem] leading-none mb-3"
        style={{ color }}
      >
        {module.score.toFixed(1)}
      </div>

      {/* 7D change in pts */}
      <div className={`text-sm font-mono ${changeColor}`}>
        {changeStr}
      </div>

      {/* Lift / Drag counts */}
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
