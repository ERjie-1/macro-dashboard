import Link from 'next/link'
import { Module } from '@/types'
import { getScoreColor } from '@/lib/mockData'

interface ModuleCardProps {
  module: Module
}

export default function ModuleCard({ module }: ModuleCardProps) {
  const color = getScoreColor(module.score)

  // Compute 7D pts change from trendData
  const len = module.trendData.length
  const prev7D = len >= 8 ? module.trendData[len - 8].value : module.prevScore
  const ptsChange = module.score - prev7D

  return (
    <Link href={`/module/${module.slug}`} className="block">
      <div className="dial-card dial-card-hover cursor-pointer overflow-hidden">
        {/* Main content */}
        <div className="px-3 pt-3 pb-2">
          {/* Module name */}
          <div className="text-xs text-gray-400 font-medium truncate">{module.name}</div>
          {/* Score + pts change inline, baseline-aligned */}
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-semibold score-text" style={{ color }}>
              {module.score.toFixed(1)}
            </span>
            <span className={`text-xs font-medium ${ptsChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {ptsChange >= 0 ? '+' : ''}{ptsChange.toFixed(1)}
            </span>
          </div>
        </div>
        {/* Bottom color bar (bhadial-style progress bar) */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full"
            style={{ width: `${Math.min(module.score, 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </Link>
  )
}
