import type { TickerOptions } from '@/types/positioning'

export function calendarDte(expiry: string, asOf?: string): number | null {
  const parse = (s?: string) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN
    const n = Date.parse(s + 'T00:00:00Z')
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s ? n : NaN
  }
  const days = (parse(expiry) - parse(asOf)) / 86400000
  return Number.isFinite(days) ? days : null
}

export function expiryRows(data: Pick<TickerOptions, 'gex'>, asOf?: string) {
  return data.gex.byExpiry.filter(x => Number.isFinite(x.gex)).map(x => ({ ...x, dte: calendarDte(x.expiry, asOf) })).sort((a, b) => a.expiry.localeCompare(b.expiry))
}

export function positioningReading(data: TickerOptions, asOf?: string) {
  const rows = expiryRows(data, asOf)
  const mass = rows.reduce((n, x) => n + Math.abs(x.gex), 0)
  const largest = mass > 0 ? [...rows].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0] : undefined
  const strikes = data.gex.byStrike.filter(x => Number.isFinite(x.gex) && x.gex !== 0)
  const peak = [...strikes].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0]
  const flip = data.gex.flipPrice
  return {
    largest, share: largest && mass > 0 ? Math.abs(largest.gex) / mass : null, peak,
    flipText: flip == null || !Number.isFinite(flip)
      ? '模型在现价 ±10% 扫描范围内未找到翻转点；不代表更远处不存在。'
      : `现价 $${data.spot.toFixed(2)} ${data.spot < flip ? '低于' : data.spot > flip ? '高于' : '等于'}模型翻转估值 $${flip.toFixed(2)}。价格接近该值时需用新的期权链重算，不能视为固定触发线。`,
  }
}

// Older snapshots contain only the explicitly identified monthly expiry.
export function selectedExpiryDetails(data: TickerOptions, expiry: string) {
  if (data.expiryDetails && Object.prototype.hasOwnProperty.call(data.expiryDetails, expiry)) return data.expiryDetails[expiry]
  return (expiry === data.pcr.targetExpiry
    ? { keyLevels: data.keyLevels, maxPain: data.maxPain, pcr: data.pcr } : null)
}

export function gammaStructure(data: Pick<TickerOptions, 'gex'>) {
  const rows = data.gex.byExpiry.filter(x => Number.isFinite(x.gex))
  const total = data.gex.total
  const sign = !Number.isFinite(total) ? '未知' : total > 0 ? '正' : total < 0 ? '负' : '零'
  const mixed = rows.some(x => x.gex > 0) && rows.some(x => x.gex < 0)
  const shape = rows.length === 0 ? '缺少到期日分布。' : rows.every(x => x.gex === 0) ? '各到期日净额均为零，没有净敞口集中的到期日。' : mixed ? '不同到期日正负净额互相抵消；全链方向不代表每一个到期日。' : '已提供的到期日净额方向一致（零值除外）。'
  return `全链模型净 Gamma 为${sign}。${shape}正值表示该模型中 Call 正向项超过 Put 负向项，负值相反；零净额不等于没有期权持仓。`
}
