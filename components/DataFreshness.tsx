'use client'

import { useEffect, useState } from 'react'
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

function hoursAgo(iso: string | undefined, nowMs: number | null): number | null {
  if (!iso || nowMs === null) return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, (nowMs - ms) / (1000 * 60 * 60))
}

function freshnessColor(hours: number | null): string {
  if (hours === null) return 'bg-gray-300'
  if (hours < 24) return 'bg-emerald-500'
  if (hours < 48) return 'bg-amber-400'
  return 'bg-red-500'
}

function formatUtcShort(iso?: string): string {
  if (!iso) return 'N/A'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function formatAge(iso: string | undefined, hours: number | null): string {
  if (!iso) return 'N/A'
  if (hours === null) return formatUtcShort(iso)
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
  const [nowMs, setNowMs] = useState<number | null>(null)

  useEffect(() => {
    setNowMs(Date.now())
  }, [])

  const snapshotIso = generatedAtUtc || dashboardUpdatedAt
  const dashboardHours = hoursAgo(snapshotIso, nowMs)

  const entries = Object.entries(sourceFreshness ?? {})
  const missingSeries: [string, { lastDate: string | null; lagTradingDays: number | null }][] = []
  const aheadSeries: [string, { lastDate: string | null; lagTradingDays: number | null }][] = []
  const laggedSeries: [string, { lastDate: string | null; lagTradingDays: number | null }][] = []
  const unknownLagSeries: [string, { lastDate: string | null; lagTradingDays: number | null }][] = []
  const onDateSeries: [string, { lastDate: string | null; lagTradingDays: number | null }][] = []

  for (const entry of entries) {
    const [, meta] = entry
    if (!meta.lastDate) {
      missingSeries.push(entry)
    } else if (asOfTradingDate && meta.lastDate > asOfTradingDate) {
      aheadSeries.push(entry)
    } else if (typeof meta.lagTradingDays !== 'number') {
      unknownLagSeries.push(entry)
    } else if (meta.lagTradingDays > 0 || (asOfTradingDate && meta.lastDate < asOfTradingDate)) {
      laggedSeries.push(entry)
    } else if (!asOfTradingDate || meta.lastDate === asOfTradingDate) {
      onDateSeries.push(entry)
    } else {
      unknownLagSeries.push(entry)
    }
  }

  laggedSeries.sort((a, b) => (b[1].lagTradingDays ?? 0) - (a[1].lagTradingDays ?? 0))

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
        <div
          className="flex items-center gap-2 text-xs text-gray-500 font-mono"
          title={snapshotIso ? `Snapshot generated: ${formatUtcShort(snapshotIso)}` : undefined}
        >
          <span className={`w-2 h-2 rounded-full ${freshnessColor(dashboardHours)}`} />
          <span>Snapshot generated: {formatAge(snapshotIso, dashboardHours)}</span>
        </div>
      </div>

      {/* Observation metadata bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg bg-gray-50/80 border border-gray-100 p-3.5 text-xs">
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Expected Observation Date</div>
          <div className="font-mono font-semibold text-gray-900 mt-0.5">
            {asOfTradingDate || '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Generated Time (UTC)</div>
          <div className="font-mono text-gray-700 mt-0.5 truncate" title={generatedAtUtc || dashboardUpdatedAt}>
            {generatedAtUtc || dashboardUpdatedAt || '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Generated Time (ET)</div>
          <div className="font-mono text-gray-700 mt-0.5 truncate" title={generatedAtEt}>
            {generatedAtEt ? generatedAtEt.slice(0, 19).replace('T', ' ') : '—'}
          </div>
        </div>
        <div>
          <div className="text-gray-400 uppercase tracking-wide text-[10px]">Tracked Series Coverage</div>
          <div className="font-mono mt-0.5 flex flex-wrap items-center gap-x-1">
            {entries.length > 0 ? (
              <>
                <span className="text-emerald-700 font-semibold">{onDateSeries.length} on-date</span>
                {aheadSeries.length > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-blue-600 font-medium">{aheadSeries.length} post-date</span>
                  </>
                )}
                <span className="text-gray-300">·</span>
                <span className="text-amber-600 font-medium">{laggedSeries.length} lagged</span>
                {unknownLagSeries.length > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-600 font-medium">{unknownLagSeries.length} unknown</span>
                  </>
                )}
                <span className="text-gray-300">·</span>
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
          const ts = m.updatedAt || snapshotIso
          const hours = hoursAgo(ts, nowMs)
          return (
            <div key={m.slug} className="flex items-center gap-2" title={ts ? formatUtcShort(ts) : undefined}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${freshnessColor(hours)}`} />
              <div className="min-w-0">
                <div className="text-xs text-gray-700 font-medium truncate">{m.name}</div>
                <div className="text-[11px] font-mono text-gray-400 truncate">{formatAge(ts, hours)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Missing, Post-date, Unknown-lag & Lagged source series breakdown */}
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

          {aheadSeries.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-blue-600 font-medium shrink-0">Dated after observation ({aheadSeries.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {aheadSeries.map(([series, meta]) => (
                  <span
                    key={series}
                    className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/70 font-mono text-[11px]"
                  >
                    {series}: {meta.lastDate}
                  </span>
                ))}
              </div>
            </div>
          )}

          {unknownLagSeries.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-gray-600 font-medium shrink-0">Lag unknown ({unknownLagSeries.length}):</span>
              <div className="flex flex-wrap gap-1.5">
                {unknownLagSeries.map(([series, meta]) => (
                  <span
                    key={series}
                    className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200/80 font-mono text-[11px]"
                  >
                    {series}: {meta.lastDate} (lag unknown)
                  </span>
                ))}
              </div>
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
                    {series}: {meta.lastDate}
                    {typeof meta.lagTradingDays === 'number' && meta.lagTradingDays > 0
                      ? ` (-${meta.lagTradingDays}td)`
                      : ''}
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
