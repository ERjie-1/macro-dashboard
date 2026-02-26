import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getModuleBySlug, getScoreColor } from '@/lib/getData'
import { dashboardData } from '@/lib/getData'
import GaugeDial from '@/components/GaugeDial'
import TrendChart from '@/components/TrendChart'
import FactorsOverview from '@/components/FactorsOverview'
import FactorTable from '@/components/FactorTable'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return dashboardData.modules.map((m) => ({ slug: m.slug }))
}

export default async function ModulePage({ params }: Props) {
  const { slug } = await params
  const module = getModuleBySlug(slug)
  if (!module) notFound()

  const scoreColor = getScoreColor(module.score)
  const delta = module.score - module.prevScore
  const isUp = delta >= 0
  const changePct = module.sevenDayChangePct
  const changePctStr = `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{module.name}</span>
        </div>

        {/* Top card: Gauge + Trend */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="grid grid-cols-2 gap-6">

            {/* Left: Gauge */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">{module.name}</h2>
              <div className="flex justify-center">
                <GaugeDial score={module.score} />
              </div>
              <div className="text-center mt-2 space-y-1">
                <div className="text-4xl font-bold" style={{ color: scoreColor }}>
                  {module.score.toFixed(1)}
                </div>
                <div className="text-sm text-gray-400">/ 100</div>
                {module.prevScore !== module.score && (
                  <div className="text-sm text-gray-500">
                    {module.prevScore.toFixed(1)} → {module.score.toFixed(1)}
                    <span className={`ml-2 font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                      ({isUp ? '+' : ''}{delta.toFixed(1)})
                    </span>
                  </div>
                )}
                <div className="text-xs text-gray-400 flex items-center justify-center gap-2 flex-wrap">
                  <span>{changePct > 0 ? '↗' : '↘'} {changePctStr} 7D</span>
                  <span>·</span>
                  <span>{module.trendDays}d {module.trendDirection}</span>
                  <span>·</span>
                  <span>5Y Percentile: {module.percentile5Y}th</span>
                </div>
                <div className="text-xs text-gray-400">{module.lastUpdated}</div>
              </div>
            </div>

            {/* Right: Trend Chart */}
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Historical Trend</h2>
              <div className="flex-1" style={{ minHeight: 220 }}>
                <TrendChart data={module.trendData} color={module.color} />
              </div>
            </div>
          </div>
        </div>

        {/* Factors Overview */}
        <FactorsOverview factors={module.factors} />

        {/* Factor Tables */}
        <FactorTable
          factors={module.factors}
          title="Scored Factors"
          moduleColor={module.color}
        />

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          © 2026 Macro Dashboard. All rights reserved.
        </div>
      </div>
    </div>
  )
}
