import { displayScore } from '@/lib/scoreMetrics'
import { dashboardData } from '@/lib/getData'
import {
  computeSeriesDeltas,
  formatOrdinal,
  getRegimeInfo,
} from '@/lib/scoreMetrics'
import GaugeDial from '@/components/GaugeDial'
import TrendChart from '@/components/TrendChart'
import ModuleCard from '@/components/ModuleCard'
import ScoreLiftDrag from '@/components/ScoreLiftDrag'
import DataFreshness from '@/components/DataFreshness'
import TodayBrief from '@/components/TodayBrief'

export default function HomePage() {
  const d = dashboardData
  const { delta1D, prev1DValue, prev1DDate, delta7D, prev7DDate } = computeSeriesDeltas(
    d.score,
    d.trendData,
    d.asOfTradingDate,
    d.prevScore
  )
  const regime = getRegimeInfo(d.score)

  const pctTextClass =
    d.percentile5Y >= 60
      ? 'text-emerald-600'
      : d.percentile5Y >= 40
        ? 'text-amber-600'
        : 'text-red-600'

  const delta1DClass =
    delta1D > 0.05 ? 'text-emerald-600' : delta1D < -0.05 ? 'text-red-600' : 'text-gray-500'

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <div className="max-w-[1340px] mx-auto px-4 py-8 space-y-6">

        {/* Top card: Score Gauge + Historical Trend */}
        <div className="dial-card p-6 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[360px_minmax(0,1fr)] gap-8 items-stretch">

            {/* Left: Gauge & MacroDial-style status readout */}
            <div className="flex flex-col justify-between">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Macro-Economic Conditions (MEC) Score
              </h2>

              <div className="flex flex-col items-center my-auto">
                <GaugeDial score={d.score} />

                <div className="text-center mt-1 space-y-2.5">
                  <div>
                    <div className="text-4xl sm:text-[42px] font-medium font-mono text-gray-900 leading-none score-text">
                      {d.score.toFixed(1)}
                    </div>
                    <div className="text-xs font-mono text-gray-400 mt-1">/ 100</div>
                  </div>

                  {/* Status line 1: prev -> curr (1D) [Regime] · Data freshness */}
                  <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-xs font-mono text-gray-600 pt-1">
                    <span title={prev1DDate ? `1D baseline: ${prev1DDate}` : undefined}>
                      <span className="text-gray-500">{displayScore(prev1DValue)}</span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="font-semibold text-gray-900">{d.score.toFixed(1)}</span>{' '}
                      <span className={`font-medium ${delta1DClass}`}>
                        ({delta1D >= 0 ? '+' : ''}{displayScore(delta1D)})
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium ${regime.pillClass}`}>
                      {regime.label}
                    </span>
                    <a
                      href="#data-freshness"
                      className="inline-flex items-center gap-1 font-sans text-gray-500 hover:text-gray-800 underline decoration-gray-300 underline-offset-2"
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${regime.dotClass}`} />
                      Data freshness
                    </a>
                  </div>

                  {/* Status line 2: 7D · streak · 5Y Historical Percentile */}
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
                      {d.trendDays}d {d.trendDirection}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className={`font-medium ${pctTextClass}`}>
                      5Y Historical Percentile: {formatOrdinal(d.percentile5Y)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Historical Trend */}
            <div className="flex flex-col min-h-[270px]">
              <TrendChart
                data={d.trendData}
                title="MEC Score Trend"
                asOfTradingDate={d.asOfTradingDate}
              />
            </div>
          </div>
        </div>

        {/* Today Brief */}
        <TodayBrief
          data={d}
          delta1D={delta1D}
          prev1DDate={prev1DDate}
          delta7D={delta7D}
          prev7DDate={prev7DDate}
        />

        {/* Module Pulse */}
        <div className="dial-card overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-[15px] font-semibold leading-snug text-gray-900">
              Module Pulse{' '}
              <span className="text-gray-400 font-normal">
                (7D{prev7DDate ? ` vs ${prev7DDate}` : ''})
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[600px] divide-x divide-gray-200">
              {d.modules.map((m) => (
                <ModuleCard key={m.slug} module={m} asOfTradingDate={d.asOfTradingDate} />
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
        <div id="data-freshness">
          <DataFreshness modules={d.modules} dashboardUpdatedAt={d.updatedAt} />
        </div>

      </div>
    </div>
  )
}
