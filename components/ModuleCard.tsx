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
      <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="text-sm text-gray-500 font-medium mb-2">{module.name}</div>
        <div className="flex items-end justify-between mb-1">
          <span className="text-3xl font-bold" style={{ color }}>
            {module.score.toFixed(1)}
          </span>
          <span className={`text-sm font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '↗' : '↘'} 7D {changeStr}
          </span>
        </div>
        {/* Color bar */}
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${module.score}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </Link>
  )
}
