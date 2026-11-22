import type { TickerOptions } from '@/types/positioning'
import { formatB } from '@/lib/format'

interface Props {
  data: TickerOptions
  tab: 'structure' | 'volatility'
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function fmtNum(v: number | null | undefined, digits = 1, suffix = '', signed = false): string {
  if (v == null || Number.isNaN(v)) return 'N/A'
  const sign = signed && v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}${suffix}`
}

export default function OptionsMetrics({ data, tab }: Props) {
  if (tab === 'volatility') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric
          label="ATM IV"
          value={fmtNum(data.skew.atmIV, 1, '%')}
          sub={`HV21: ${fmtNum(data.vrp.hv21, 1, '%')}`}
        />
        <Metric
          label="25Δ Skew"
          value={fmtNum(data.skew.riskReversal25d, 1)}
          sub={`Put: ${fmtNum(data.skew.putIV25d, 1, '%')} / Call: ${fmtNum(data.skew.callIV25d, 1, '%')}`}
        />
        <Metric
          label="VRP"
          value={fmtNum(data.vrp.premium, 1, '', true)}
          sub={`IV ${fmtNum(data.vrp.iv, 1, '%')} − HV ${fmtNum(data.vrp.hv21, 1, '%')}`}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Metric label="Total GEX" value={formatB(data.gex.total)} sub={data.gex.flipPrice ? `Flip: $${data.gex.flipPrice}` : undefined} />
      <Metric label="PCR OI" value={fmtNum(data.pcr.oiRatio, 2)} sub={`${data.pcr.targetExpiry} · All: ${fmtNum(data.pcr.allExpOiRatio, 2)}`} />
      <Metric label="PCR Vol" value={fmtNum(data.pcr.volRatio, 2)} sub={`${data.pcr.targetExpiry} · All: ${fmtNum(data.pcr.allExpVolRatio, 2)}`} />
      <Metric label="Max Pain" value={data.maxPain == null ? 'N/A' : `$${data.maxPain}`} sub={`${data.pcr.targetExpiry} · Spot: $${data.spot}`} />
      <Metric label="Key Levels" value={data.keyLevels.putWall ? `$${data.keyLevels.putWall.strike}` : '无可核峰'} sub={`${data.pcr.targetExpiry} · Put OI 峰 (${data.keyLevels.putWall ? (data.keyLevels.putWall.oi / 1000).toFixed(0) : 'N/A'}K OI)`} />
    </div>
  )
}
