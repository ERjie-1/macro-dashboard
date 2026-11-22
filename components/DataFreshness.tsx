import type { MacroDashboard, Module } from '@/types'

interface Props {
  modules: Module[]
  dashboardUpdatedAt?: string
  asOfTradingDate?: string
  generatedAtUtc?: string
  generatedAtEt?: string
  sessionScope?: MacroDashboard['sessionScope']
  sourceFreshness?: MacroDashboard['sourceFreshness']
}

function hoursAgo(iso?: string): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return (Date.now() - ms) / (1000 * 60 * 60)
}

function freshnessColor(hours: number | null): string {
  if (hours === null) return 'bg-gray-300'
  if (hours < 24) return 'bg-emerald-500'
  if (hours < 48) return 'bg-amber-400'
  return 'bg-red-500'
}

function formatAge(hours: number | null): string {
  if (hours === null) return 'N/A'
  if (hours < 1) return '<1h ago'
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DataFreshness({
  modules,
  dashboardUpdatedAt,
  asOfTradingDate,
  generatedAtUtc,
  generatedAtEt,
  sessionScope,
  sourceFreshness,
}: Props) {
  const lastCheckIso = generatedAtUtc || dashboardUpdatedAt
  const dashboardHours = hoursAgo(lastCheckIso)

  const entries = Object.entries(sourceFreshness ?? {})
  const missingSeries = entries.filter(([, meta]) => !meta.lastDate)
  const laggedSeries = entries
    .filter(([, meta]) => meta.lastDate && typeof meta.lagTradingDays === 'number' && meta.lagTradingDays > 0)
    .sort((a, b) => (b[1].lagTradingDays ?? 0) - (a[1].lagTradingDays ?? 0))
  const currentSeriesCount = entries.length - missingSeries.length - laggedSeries.length

  return (
    <section className="dial-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">Data Freshness</h3>
          {sessionScope && (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono text-[11px]">
              {sessionScope}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
          <span className={`w-2 h-2 rounded-full ${freshnessColor(dashboardHours)}`} />
          <span>Last checked: {formatAge(dashboardHours)}</span>
        </div>
      </div>

      {/* Observation metadata bar (matches MacroDial footer freshness details) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg bg-gray-50/80 border border-gray-100 p-3.5 text-xs">
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Expected Observation Date</div>
          <div className="font-mono font-semibold text-gray-900 mt-0.5">
            {asOfTradingDate || '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Cache Written (UTC)</div>
          <div className="font-mono text-gray-700 mt-0.5 truncate" title={generatedAtUtc || dashboardUpdatedAt}>
            {generatedAtUtc || dashboardUpdatedAt || '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Cache Written (ET)</div>
          <div className="font-mono text-gray-700 mt-0.5 truncate" title={generatedAtEt}>
            {generatedAtEt ? generatedAtEt.slice(0, 19).replace('T', ' ') : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Tracked Series Coverage</div>
          <div className="font-mono mt-0.5">
            {entries.length > 0 ? (
              <>
                <span className="text-emerald-700 font-semibold">{currentSeriesCount} on-date</span>
                <span className="text-gray-300 mx-1">·</span>
                <span className="text-amber-600 font-medium">{laggedSeries.length} lagged</span>
                <span className="text-gray-300 mx-1">·</span>
                <span className={missingSeries.length > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                  {missingSeries.length} missing
                </span>
              </>
            ) : (
              <span className="text-gray-400">No series metadata</span>
            )}
          </div>
        </div>
      </div>

      {/* Module freshness grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {modules.map((m) => {
          const hours = hoursAgo(m.updatedAt || lastCheckIso)
          return (
            <div key={m.slug} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${freshnessColor(hours)}`} />
              <div className="min-w-0">
                <div className="text-xs text-gray-700 font-medium truncate">{m.name}</div>
                <div className="text-[11px] font-mono text-gray-400">{formatAge(hours)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Missing & Lagged source series breakdown */}
      {entries.length > 0 && (
        <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
          {missingSeries.length > 0 ? (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-red-600 font-semibold shrink-0">Missing series ({missingSeries.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {missingSeries.map(([series]) => (
                  <span
                    key={series}
                    className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200/70 font-mono text-[11px]"
                  >
                    {series}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-emerald-700 font-medium">
              All {entries.length} underlying FRED/market series present (0 missing).
            </div>
          )}

          {laggedSeries.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-gray-500 font-medium shrink-0">Publication lag ({laggedSeries.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {laggedSeries.map(([series, meta]) => (
                  <span
                    key={series}
                    className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-[11px]"
                    title={`Last observation: ${meta.lastDate}`}
                  >
                    {series}: {meta.lastDate} (-{meta.lagTradingDays}td)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="pt-2 border-t border-gray-100 flex items-center gap-4 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;24h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 24–48h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;48h</span>
      </div>
    </section>
  )
}
