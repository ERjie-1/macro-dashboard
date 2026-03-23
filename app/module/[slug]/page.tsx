import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getModuleBySlug, getScoreColor } from '@/lib/getData'
import { dashboardData } from '@/lib/getData'
import GaugeDial from '@/components/GaugeDial'
import TrendChart from '@/components/TrendChart'
import ModuleFactorsSection from '@/components/ModuleFactorsSection'
import RelativeTime from '@/components/RelativeTime'

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
  const delta1D = module.score - module.prevScore
  const tLen = module.trendData.length
  const delta7D = tLen >= 7 ? module.score - module.trendData[tLen - 7].value : delta1D

  const pctColor = module.percentile5Y >= 60
    ? 'bg-green-100 text-green-700'
    : module.percentile5Y >= 40
      ? 'bg-orange-100 text-orange-700'
      : 'bg-red-100 text-red-700'

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
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className={`font-medium ${delta1D >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    1D {delta1D >= 0 ? '+' : ''}{delta1D.toFixed(1)} pts
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className={`font-medium ${delta7D >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    7D {delta7D >= 0 ? '+' : ''}{delta7D.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pctColor}`}>
                    {module.percentile5Y}th pctl
                  </span>
                  <span>·</span>
                  <span>{module.trendDays}d {module.trendDirection}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {module.updatedAt ? <RelativeTime isoString={module.updatedAt} /> : module.lastUpdated}
                </div>
              </div>
            </div>

            {/* Right: Trend Chart */}
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">{module.name} Score Trend</h2>
              <div className="flex-1" style={{ minHeight: 220 }}>
                <TrendChart data={module.trendData} color={module.color} />
              </div>
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
