import type { Factor, MacroDashboard, Module, TrendPoint } from '@/types'

export interface BaselineDelta {
  delta1D: number
  prev1DValue: number
  prev1DDate: string | null
  delta7D: number
  prev7DValue: number
  prev7DDate: string | null
}

export interface ModuleMover {
  name: string
  slug: string
  delta: number
  baseDate: string | null
}

export interface RegimeInfo {
  label: 'Supportive' | 'Neutral' | 'Mixed' | 'Restrictive'
  pillClass: string
  dotClass: string
}

function parseIsoDate(iso?: string | null): Date | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0,10) === m[0] ? d : null
}

export function parseTrendPointDate(dateStr: string, asOfDate: Date | null): Date | null {
  const iso = parseIsoDate(dateStr)
  if (iso) return iso
  const md = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!md || !asOfDate) return null
  const month = Number(md[1])
  const day = Number(md[2])
  let year = asOfDate.getUTCFullYear()
  if (new Date(Date.UTC(year, month - 1, day)).getTime() > asOfDate.getTime()) {
    year -= 1
  }
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null
}

export function formatShortMonthDay(dateStr: string, asOfIso?: string | null): string {
  const asOfDate = parseIsoDate(asOfIso)
  const parsed = parseTrendPointDate(dateStr, asOfDate)
  if (!parsed) return dateStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parsed.getUTCMonth()]} ${parsed.getUTCDate()}`
}

export function formatOrdinal(n: number): string {
  const rounded = Math.round(n)
  const mod100 = rounded % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`
  switch (rounded % 10) {
    case 1:
      return `${rounded}st`
    case 2:
      return `${rounded}nd`
    case 3:
      return `${rounded}rd`
    default:
      return `${rounded}th`
  }
}

export function computeSeriesDeltas(
  score: number,
  trendData: TrendPoint[],
  asOfTradingDate?: string | null,
  fallbackPrevScore?: number
): BaselineDelta {
  const asOfDate = parseIsoDate(asOfTradingDate)
  const points = asOfDate ? trendData.map(p => ({...p, parsed: parseTrendPointDate(p.date, asOfDate)}))
    .filter(p => p.parsed && p.parsed.getTime() < asOfDate.getTime() && Number.isFinite(p.value))
    .sort((a,b) => a.parsed!.getTime()-b.parsed!.getTime()) : []
  const prev1DPoint = points.at(-1)
  const prev7DPoint = asOfDate ? points.filter(p => p.parsed!.getTime() <= asOfDate.getTime()-7*86400000).at(-1) : undefined
  // An absent dated baseline is unknown; never manufacture a zero change or
  // silently substitute a different interval from array position/prevScore.
  const prev1DValue = prev1DPoint?.value ?? NaN
  const prev7DValue = prev7DPoint?.value ?? NaN
  const prev1DDate = prev1DPoint?.parsed?.toISOString().slice(0,10) ?? null
  const prev7DDate = prev7DPoint?.parsed?.toISOString().slice(0,10) ?? null
  const delta1D = score - prev1DValue
  const delta7D = score - prev7DValue

  return {
    delta1D,
    prev1DValue,
    prev1DDate,
    delta7D,
    prev7DValue,
    prev7DDate,
  }
}

export function getRegimeInfo(score: number): RegimeInfo {
  if (score >= 60) {
    return {
      label: 'Supportive',
      pillClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      dotClass: 'bg-emerald-500',
    }
  }
  if (score >= 45) {
    return {
      label: 'Neutral',
      pillClass: 'bg-gray-100 text-gray-700 border border-gray-200/80',
      dotClass: 'bg-gray-400',
    }
  }
  if (score >= 35) {
    return {
      label: 'Mixed',
      pillClass: 'bg-amber-50 text-amber-700 border border-amber-200/80',
      dotClass: 'bg-amber-500',
    }
  }
  return {
    label: 'Restrictive',
    pillClass: 'bg-red-50 text-red-700 border border-red-200/80',
    dotClass: 'bg-red-500',
  }
}

export function getModuleMovers(
  modules: Module[],
  asOfTradingDate?: string | null
): {
  topMover1D: ModuleMover | null
  topMover7D: ModuleMover | null
  lifts1D: ModuleMover[]
  drags1D: ModuleMover[]
} {
  const movers1D: ModuleMover[] = []
  const movers7D: ModuleMover[] = []

  for (const m of modules) {
    const d = computeSeriesDeltas(m.score, m.trendData, asOfTradingDate, m.prevScore)
    if (Number.isFinite(d.delta1D)) movers1D.push({ name: m.name, slug: m.slug, delta: d.delta1D, baseDate: d.prev1DDate })
    if (Number.isFinite(d.delta7D)) movers7D.push({ name: m.name, slug: m.slug, delta: d.delta7D, baseDate: d.prev7DDate })
  }

  movers1D.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  movers7D.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const lifts1D = movers1D.filter((m) => m.delta > 0.2).sort((a, b) => b.delta - a.delta)
  const drags1D = movers1D.filter((m) => m.delta < -0.2).sort((a, b) => a.delta - b.delta)

  return {
    topMover1D: movers1D[0] ?? null,
    topMover7D: movers7D[0] ?? null,
    lifts1D,
    drags1D,
  }
}

export interface ExtremeFactorItem {
  name: string
  moduleName: string
  percentile: number
  status: Factor['status']
}

export function getExtremeFactors(dashboard: MacroDashboard): {
  supportive: ExtremeFactorItem[]
  restrictive: ExtremeFactorItem[]
  thresholdObservations: ExtremeFactorItem[]
} {
  const all: ExtremeFactorItem[] = []
  for (const m of dashboard.modules) {
    for (const f of m.factors) {
      if (f.isExtra) continue
      // f.score is direction-aligned (100 = most supportive, 0 = most restrictive),
      // whereas historicalPercentile5Y is raw uninverted percentile.
      if (typeof f.score !== 'number' || !Number.isFinite(f.score)) continue
      const alignedScore = f.score
      all.push({
        name: f.name,
        moduleName: m.name,
        percentile: Math.max(0, Math.min(100, Math.round(alignedScore))),
        status: f.status,
      })
    }
  }

  const supportive = all
    .filter((f) => f.percentile >= 80)
    .sort((a, b) => b.percentile - a.percentile)

  const restrictive = all
    .filter((f) => f.percentile <= 20)
    .sort((a, b) => a.percentile - b.percentile)

  const thresholdObservations = all
    .filter((f) => f.percentile <= 5 || f.percentile >= 95)
    .sort((a, b) => Math.min(a.percentile, 100 - a.percentile) - Math.min(b.percentile, 100 - b.percentile))

  return { supportive, restrictive, thresholdObservations }
}

export function displayScore(n: number): string { return Number.isFinite(n) ? n.toFixed(1) : 'N/A' }
