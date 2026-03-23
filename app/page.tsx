import { dashboardData, getScoreColor } from '@/lib/getData'
import GaugeDial from '@/components/GaugeDial'
import TrendChart from '@/components/TrendChart'
import ModuleCard from '@/components/ModuleCard'
import ScoreLiftDrag from '@/components/ScoreLiftDrag'
import DataFreshness from '@/components/DataFreshness'
import RelativeTime from '@/components/RelativeTime'
import TodayBrief from '@/components/TodayBrief'

export default function HomePage() {
  const d = dashboardData
  const scoreColor = getScoreColor(d.score)
  const delta1D = d.score - d.prevScore
  const len = d.trendData.length
  const delta7D = len >= 7 ? d.score - d.trendData[len - 7].value : delta1D

  const pctColor = d.percentile5Y >= 60
    ? 'bg-green-100 text-green-700'
    : d.percentile5Y >= 40
      ? 'bg-orange-100 text-orange-700'
      : 'bg-red-100 text-red-700'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Top card: Score + Historical Trend */}
        <div className="dial-card p-6">
          <div className="grid grid-cols-2 gap-6">

            {/* Left: Gauge */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Macro-Economic Conditions Score
              </h2>
              <div className="flex justify-center">
                <GaugeDial score={d.score} />
              </div>
              <div className="text-center mt-2 space-y-1">
                <div className="text-5xl font-bold score-text" style={{ color: scoreColor }}>
                  {d.score.toFixed(1)}
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
                    {d.percentile5Y}th pctl
                  </span>
                  <span>·</span>
                  <span>{d.trendDays}d {d.trendDirection}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {d.updatedAt ? <RelativeTime isoString={d.updatedAt} /> : d.lastUpdated}
                </div>
              </div>
            </div>

            {/* Right: Historical Trend */}
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">MEC Score Trend</h2>
              <div className="flex-1" style={{ minHeight: 220 }}>
                <TrendChart data={d.trendData} color={scoreColor} />
              </div>
            </div>
          </div>
        </div>

        {/* Today Brief */}
        <TodayBrief data={d} delta1D={delta1D} delta7D={delta7D} />

        {/* Module Pulse — bhadial: single card, 7-col grid, divide-x */}
        <div className="dial-card overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-[15px] font-semibold leading-snug">
              Module Pulse{' '}
              <span className="text-gray-400 font-normal">(7D)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[600px] divide-x divide-gray-200">
              {d.modules.map((m) => (
                <ModuleCard key={m.slug} module={m} />
              ))}
            </div>
          </div>
        </div>

        {/* Top Drivers */}
        <div>
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Top Drivers
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              Factors with the largest positive and negative contribution to score change
            </p>
          </div>
          <ScoreLiftDrag lift={d.scoreLift} drag={d.scoreDrag} />
        </div>

        {/* Data Freshness */}
        <DataFreshness modules={d.modules} dashboardUpdatedAt={d.updatedAt} />

      </div>
    </div>
  )
}
