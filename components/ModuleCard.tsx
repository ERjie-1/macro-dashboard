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
        <div className="px-3.5 pt-3 pb-2.5">
          {/* Name + score baseline-aligned (bhadial layout) */}
          <div className="flex items-baseline gap-1">
            <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest leading-none shrink-0">
              {module.name}
            </span>
            <span
              className="text-3xl font-semibold leading-none tracking-tight"
              style={{ color, fontVariantNumeric: 'tabular-nums' }}
            >
              {module.score.toFixed(1)}
            </span>
          </div>
          {/* 7D change */}
          <div className="mt-1.5">
            <span className={`text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
              {isUp ? '↗' : '↘'} 7D {changeStr}
            </span>
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
