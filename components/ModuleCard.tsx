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

  // Count factor directions
  const factorsUp = module.factors.filter((f) => !f.isExtra && f.changeDirection === 'up').length
  const factorsDown = module.factors.filter((f) => !f.isExtra && f.changeDirection === 'down').length

  return (
    <Link href={`/module/${module.slug}`} className="block">
      <div className="dial-card dial-card-hover p-4 cursor-pointer text-center">
        {/* Module name */}
        <div className="text-xs text-gray-400 font-medium">{module.name}</div>
        {/* Score */}
        <div className="text-4xl font-semibold score-text mt-2 mb-1" style={{ color }}>
          {module.score.toFixed(1)}
        </div>
        {/* Pts change */}
        <div className={`text-xs font-medium ${ptsChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {ptsChange >= 0 ? '+' : ''}{ptsChange.toFixed(1)} pts
        </div>
        {/* Factor arrows */}
        {(factorsUp > 0 || factorsDown > 0) && (
          <div className="mt-1.5 text-xs space-x-1">
            {factorsUp > 0 && <span className="text-green-600">{factorsUp}▲</span>}
            {factorsDown > 0 && <span className="text-red-500">{factorsDown}▼</span>}
          </div>
        )}
      </div>
    </Link>
  )
}
