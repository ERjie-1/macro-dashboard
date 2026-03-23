import Link from 'next/link'
import { Module } from '@/types'
import { getScoreColor } from '@/lib/mockData'

interface ModuleCardProps {
  module: Module
}

export default function ModuleCard({ module }: ModuleCardProps) {
  const color = getScoreColor(module.score)
  const isUp = module.sevenDayChangePct > 0
  const changeStr = `${isUp ? '+' : ''}${module.sevenDayChangePct.toFixed(2)}%`

  return (
    <Link href={`/module/${module.slug}`} className="block">
      <div className="dial-card dial-card-hover p-4 cursor-pointer">
        {/* Row 1: name + score left-aligned baseline */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest">{module.name}</span>
          <span className="text-4xl font-bold leading-none score-text" style={{ color }}>
            {module.score.toFixed(1)}
          </span>
        </div>
        {/* Row 2: 7D change left-aligned */}
        <div className="mt-1">
          <span className={`text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '↗' : '↘'} 7D {changeStr}
          </span>
        </div>
        {/* Color bar */}
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${module.score}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </Link>
  )
}
