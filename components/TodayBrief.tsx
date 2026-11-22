'use client'

import type { MacroDashboard } from '@/types'
import {
  formatOrdinal,
  getExtremeFactors,
  getModuleMovers,
  getRegimeInfo,
} from '@/lib/scoreMetrics'

interface Props {
  data: MacroDashboard
  delta1D: number
  prev1DDate: string | null
  delta7D: number
  prev7DDate: string | null
}

function formatSignedPts(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)} pts`
}

function deltaTextClass(val: number): string {
  if (val > 0.05) return 'text-emerald-600'
  if (val < -0.05) return 'text-red-600'
  return 'text-gray-500'
}

export default function TodayBrief({
  data,
  delta1D,
  prev1DDate,
  delta7D,
  prev7DDate,
}: Props) {
  const { topMover1D, topMover7D, lifts1D, drags1D } = getModuleMovers(
    data.modules,
    data.asOfTradingDate
  )
  const { supportive, restrictive, thresholdObservations } = getExtremeFactors(data)
  const regime = getRegimeInfo(data.score)

  const asOfLabel = data.asOfTradingDate || data.lastUpdated

  const badge =
    delta1D <= -0.3
      ? {
          text: '1D DETERIORATING',
          cls: 'text-red-600 border-red-200 bg-red-50/70',
        }
      : delta1D >= 0.3
        ? {
            text: '1D IMPROVING',
            cls: 'text-emerald-700 border-emerald-200 bg-emerald-50/70',
          }
        : {
            text: '1D STABLE',
            cls: 'text-gray-600 border-gray-200 bg-gray-50',
          }

  const liftNames = lifts1D.slice(0, 3).map((m) => m.name).join(', ')
  const dragNames = drags1D.slice(0, 3).map((m) => m.name).join(', ')

  return (
    <section className="dial-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-gray-100">
        <h2 className="text-[15px] font-semibold text-gray-900">Today Brief</h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-gray-500 underline decoration-gray-300 underline-offset-4">
            {asOfLabel}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full border font-mono text-[11px] font-medium tracking-wide ${badge.cls}`}
          >
            {badge.text}
          </span>
        </div>
      </div>

      {/* Key movers strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-b border-gray-100">
        <div>
          <div className="text-xs text-gray-500 mb-1">MEC Score Change</div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm">
            <span
              className={`font-semibold ${deltaTextClass(delta1D)}`}
              title={prev1DDate ? `vs ${prev1DDate}` : undefined}
            >
              1D {formatSignedPts(delta1D)}
            </span>
            <span
              className={`font-semibold ${deltaTextClass(delta7D)}`}
              title={prev7DDate ? `vs ${prev7DDate}` : undefined}
            >
              7D {formatSignedPts(delta7D)}
            </span>
          </div>
          {(prev1DDate || prev7DDate) && (
            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
              {prev1DDate ? `1D vs ${prev1DDate}` : ''}
              {prev1DDate && prev7DDate ? ' · ' : ''}
              {prev7DDate ? `7D vs ${prev7DDate}` : ''}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">1D Top Mover</div>
          {topMover1D ? (
            <div className="font-mono text-sm">
              <span className="font-semibold text-gray-900">{topMover1D.name}</span>{' '}
              <span className={`font-semibold ${deltaTextClass(topMover1D.delta)}`}>
                {formatSignedPts(topMover1D.delta)}
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-400">—</div>
          )}
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">7D Top Mover</div>
          {topMover7D ? (
            <div className="font-mono text-sm">
              <span className="font-semibold text-gray-900">{topMover7D.name}</span>{' '}
              <span className={`font-semibold ${deltaTextClass(topMover7D.delta)}`}>
                {formatSignedPts(topMover7D.delta)}
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-400">—</div>
          )}
        </div>
      </div>

      {/* Concise factual narrative */}
      <div className="py-4 text-[13.5px] text-gray-700 leading-relaxed space-y-1">
        <p>
          MEC sits at the <span className="font-medium text-gray-900">{formatOrdinal(data.percentile5Y)}</span>{' '}
          percentile of its 5Y range ({asOfLabel}).
        </p>
        <p>
          {liftNames ? (
            <>
              Today&apos;s lift came from <span className="font-medium text-gray-900">{liftNames}</span>.{' '}
            </>
          ) : null}
          {dragNames ? (
            <>
              Drag came from <span className="font-medium text-gray-900">{dragNames}</span>.{' '}
            </>
          ) : null}
          Current regime is <span className="font-medium text-gray-900">{regime.label}</span>
          {data.trendDays > 0 ? ` (${data.trendDays}d ${data.trendDirection}).` : '.'}
        </p>
      </div>

      {/* Bottom 3-column extreme factor cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {/* SUPPORTIVE */}
        <div className="rounded-xl border border-gray-200/80 bg-gray-50/40 p-4">
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Supportive
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-gray-900">
              {supportive.length}
            </span>
            <span className="text-xs text-gray-500">extreme factors (≥80th)</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {supportive.length > 0 ? (
              supportive.slice(0, 4).map((f) => (
                <div key={`${f.moduleName}-${f.name}`} className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-800 font-medium">{f.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-mono text-[10px]">
                    {formatOrdinal(f.percentile)}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-gray-400">No factors ≥80th pctl</span>
            )}
          </div>
        </div>

        {/* RESTRICTIVE */}
        <div className="rounded-xl border border-gray-200/80 bg-gray-50/40 p-4">
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Restrictive
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-gray-900">
              {restrictive.length}
            </span>
            <span className="text-xs text-gray-500">extreme factors (≤20th)</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {restrictive.length > 0 ? (
              restrictive.slice(0, 4).map((f) => (
                <div key={`${f.moduleName}-${f.name}`} className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-800 font-medium">{f.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200/70 font-mono text-[10px]">
                    {formatOrdinal(f.percentile)}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-gray-400">No factors ≤20th pctl</span>
            )}
          </div>
        </div>

        {/* THRESHOLD OBSERVATIONS */}
        <div className="rounded-xl border border-gray-200/80 bg-gray-50/40 p-4">
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Threshold Observations
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-gray-900">
              {thresholdObservations.length}
            </span>
            <span className="text-xs text-gray-500">observations (≤5th / ≥95th)</span>
          </div>
          <div className="mt-3 space-y-2">
            {thresholdObservations.length > 0 ? (
              thresholdObservations.slice(0, 3).map((f) => {
                const isLow = f.percentile <= 5
                return (
                  <div key={`${f.moduleName}-${f.name}`} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-800 font-medium">{f.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full border font-mono text-[10px] ${
                          isLow
                            ? 'bg-red-50 text-red-700 border-red-200/70'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                        }`}
                      >
                        {formatOrdinal(f.percentile)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Beyond a {isLow ? 'restrictive' : 'supportive'} 5Y tail threshold
                    </div>
                  </div>
                )
              })
            ) : (
              <span className="text-xs text-gray-400">No tail threshold breaches</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
