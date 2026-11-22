import type { TrendPoint } from '@/types'

export function factorHistory(data: TrendPoint[]) {
  const points = data.filter(p => Number.isFinite(p.value)).slice(-90)
  const values = points.map(p => p.value)
  if (!values.length) return { points, domain: [0, 1] as [number, number], min: null, max: null }
  const min = Math.min(...values), max = Math.max(...values)
  const pad = max === min ? Math.max(Math.abs(min) * .01, .0001) : (max - min) * .12
  return { points, domain: [min - pad, max + pad] as [number, number], min, max }
}
