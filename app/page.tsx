import { dashboardData, getScoreColor } from '@/lib/getData'
import GaugeDial from '@/components/GaugeDial'
import TrendChart from '@/components/TrendChart'
import ModuleCard from '@/components/ModuleCard'
import ScoreLiftDrag from '@/components/ScoreLiftDrag'
import RelativeTime from '@/components/RelativeTime'

export default function HomePage() {
  const d = dashboardData
  const scoreColor = getScoreColor(d.score)
  const delta = d.score - d.prevScore
  const isUp = delta >= 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Top card: Score + Historical Trend */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
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
                <div className="text-4xl font-bold" style={{ color: scoreColor }}>
                  {d.score.toFixed(1)}
                </div>
                <div className="text-sm text-gray-400">/ 100</div>
                <div className="text-sm text-gray-500">
                  {d.prevScore.toFixed(1)} → {d.score.toFixed(1)}
                  <span className={`ml-2 font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                    ({isUp ? '+' : ''}{delta.toFixed(1)})
                  </span>
                </div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-2">
                  <span>{isUp ? '↗' : '↘'} {Math.abs(delta).toFixed(1)} pts 7D</span>
                  <span>·</span>
                  <span>{d.trendDays}d {d.trendDirection}</span>
                  <span>·</span>
                  <span>5Y Percentile: {d.percentile5Y}th</span>
                </div>
                <div className="text-xs text-gray-400">
                  {d.updatedAt ? <RelativeTime isoString={d.updatedAt} /> : d.lastUpdated}
                </div>
              </div>
            </div>

            {/* Right: Historical Trend */}
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Historical Trend</h2>
              <div className="flex-1" style={{ minHeight: 220 }}>
                <TrendChart data={d.trendData} color="#d97706" />
              </div>
            </div>
          </div>
        </div>

        {/* Module cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Modules
            </span>
            <span className="text-xs text-gray-400">7D Change</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {d.modules.slice(0, 4).map((m) => (
              <ModuleCard key={m.slug} module={m} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            {d.modules.slice(4).map((m) => (
              <ModuleCard key={m.slug} module={m} />
            ))}
          </div>
        </div>

        {/* Factors at a Glance */}
        <div>
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Factors at a Glance
            </span>
          </div>
          <ScoreLiftDrag lift={d.scoreLift} drag={d.scoreDrag} />
        </div>

      </div>
    </div>
  )
}
