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
      <div className="dial-card dial-card-hover cursor-pointer overflow-hidden">
        <div className="px-3 pt-3 pb-2">
          {/* Module name — own line */}
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest truncate">
            {module.name}
          </div>
          {/* Score — own line, left-aligned */}
          <div
            className="text-[28px] font-semibold leading-tight mt-0.5"
            style={{ color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
          >
            {module.score.toFixed(1)}
          </div>
          {/* 7D change */}
          <div className={`text-[11px] font-medium mt-0.5 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '↗' : '↘'} 7D {changeStr}
          </div>
        </div>
        {/* Bottom color bar */}
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
