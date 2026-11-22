import type { Factor } from '@/types'
import { parseTrendPointDate } from './scoreMetrics'

// Changes use dated display observations, never the legacy preformatted string.
export function factorChange(factor: Factor, asOf?: string) {
  const unknown = { label: 'N/A', detail: '缺少可比较的日期或观测值', delta: null as number | null }
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return unknown
  const anchor = new Date(asOf + 'T00:00:00Z')
  if (!Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0,10) !== asOf) return unknown
  const points = factor.trendData.map(p => ({ ...p, time: parseTrendPointDate(p.date, anchor)?.getTime() }))
    .filter((p): p is { date: string; value: number; time: number } => typeof p.time === 'number' && p.time <= anchor.getTime() && Number.isFinite(p.value)).sort((a,b) => a.time-b.time)
  const current = points.at(-1)
  const boundary = anchor.getTime() - 7 * 86400000
  const baseline = points.filter(p => p.time <= boundary).at(-1)
  if (!current || !baseline || current.time !== anchor.getTime() || boundary - baseline.time > 4 * 86400000) return unknown
  let delta = current.value - baseline.value
  let unit = '原值'
  if (factor.value.trim().endsWith('%')) { delta *= 100; unit = '百分点' }
  else if (factor.value.startsWith('$')) unit = factor.value.endsWith('B') ? '十亿美元' : '美元'
  else if (['vix','vix-3m','dxy','nfci'].includes(factor.id)) unit = '点'
  if (Math.abs(delta) < 1e-9) delta = 0
  const value = delta.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return { label: `${delta > 0 ? '+' : ''}${value} ${unit}`, delta,
    detail: `${new Date(baseline.time).toISOString().slice(0,10)} → ${asOf}；按图中原始观测值计算绝对差（输入最多四位小数），不是相对涨跌幅。` }
}
