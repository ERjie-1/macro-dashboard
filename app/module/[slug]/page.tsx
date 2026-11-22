import { displayScore } from '@/lib/scoreMetrics'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getModuleBySlug, dashboardData } from '@/lib/getData'
import {
  computeSeriesDeltas,
  formatOrdinal,
  getRegimeInfo,
} from '@/lib/scoreMetrics'
import GaugeDial from '@/components/GaugeDial'
import TrendChart from '@/components/TrendChart'
import ModuleFactorsSection from '@/components/ModuleFactorsSection'

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

  const { delta1D, prev1DValue, prev1DDate, delta7D, prev7DDate } = computeSeriesDeltas(
    module.score,
    module.trendData,
    dashboardData.asOfTradingDate,
    module.prevScore
  )
  const regime = getRegimeInfo(module.score)

  const pctTextClass =
    module.percentile5Y >= 60
      ? 'text-emerald-600'
      : module.percentile5Y >= 40
        ? 'text-amber-600'
        : 'text-red-600'

  const delta1DClass =
    delta1D > 0.05 ? 'text-emerald-600' : delta1D < -0.05 ? 'text-red-600' : 'text-gray-500'

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <div className="max-w-[1340px] mx-auto px-4 py-8 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{module.name}</span>
        </div>

        {/* Top card: Gauge + Trend */}
        <div className="dial-card p-6 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[360px_minmax(0,1fr)] gap-8 items-stretch">

            {/* Left: Gauge */}
            <div className="flex flex-col justify-between">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{module.name}</h2>
              <div className="flex flex-col items-center my-auto">
                <GaugeDial score={module.score} />
                <div className="text-center mt-1 space-y-2">
                  <div>
                    <div className="text-4xl font-medium font-mono text-gray-900 leading-none score-text">
                      {module.score.toFixed(1)}
                    </div>
                    <div className="text-xs font-mono text-gray-400 mt-1">/ 100</div>
                  </div>
                  <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-xs font-mono text-gray-600">
                    <span title={prev1DDate ? `1D baseline: ${prev1DDate}` : undefined}>
                      <span className="text-gray-500">{displayScore(prev1DValue)}</span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="font-semibold text-gray-900">{module.score.toFixed(1)}</span>{' '}
                      <span className={`font-medium ${delta1DClass}`}>
                        ({delta1D >= 0 ? '+' : ''}{displayScore(delta1D)})
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium ${regime.pillClass}`}>
                      {regime.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span
                      className="font-mono"
                      title={prev7DDate ? `7D baseline: ${prev7DDate}` : undefined}
                    >
                      {!Number.isFinite(delta7D) ? '' : delta7D >= 0 ? '▲' : '▼'} {delta7D >= 0 ? '+' : ''}
                      {displayScore(delta7D)} pts 7D
                    </span>
                    <span className="text-gray-300">·</span>
                    <span>
                      {module.trendDays}d {module.trendDirection}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className={`font-medium ${pctTextClass}`}>
                      5Y Historical Percentile: {formatOrdinal(module.percentile5Y)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Trend Chart */}
            <div className="flex flex-col min-h-[260px]">
              <TrendChart
                data={module.trendData}
                title={`${module.name} Score Trend`}
                asOfTradingDate={dashboardData.asOfTradingDate}
              />
            </div>
          </div>
        </div>

        {/* Factors Overview + Factor Tables (with filter) */}
        <ModuleFactorsSection factors={module.factors} moduleColor={module.color} />

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          © 2026 Macro Dashboard. All rights reserved.
        </div>
      </div>
    </div>
  )
}
