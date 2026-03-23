import type { TickerOptions } from '@/types/positioning'
import { formatB } from '@/lib/format'

interface Props {
  data: TickerOptions
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

export default function OptionsMetrics({ data }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Metric label="Total GEX" value={formatB(data.gex.total)} sub={data.gex.flipPrice ? `Flip: $${data.gex.flipPrice}` : undefined} />
      <Metric label="PCR OI (OPEX)" value={data.pcr.oiRatio.toFixed(2)} sub={`All: ${data.pcr.allExpOiRatio.toFixed(2)}`} />
      <Metric label="PCR Vol (OPEX)" value={data.pcr.volRatio.toFixed(2)} sub={`All: ${data.pcr.allExpVolRatio.toFixed(2)}`} />
      <Metric label="ATM IV" value={`${data.skew.atmIV.toFixed(1)}%`} sub={`HV21: ${data.vrp.hv21.toFixed(1)}%`} />
      <Metric label="25Δ Skew" value={data.skew.riskReversal25d.toFixed(1)} sub={`Put: ${data.skew.putIV25d.toFixed(1)}% / Call: ${data.skew.callIV25d.toFixed(1)}%`} />
      <Metric label="VRP" value={`${data.vrp.premium >= 0 ? '+' : ''}${data.vrp.premium.toFixed(1)}`} sub={`IV ${data.vrp.iv.toFixed(1)}% − HV ${data.vrp.hv21.toFixed(1)}%`} />
      <Metric label="Max Pain" value={`$${data.maxPain}`} sub={`Spot: $${data.spot}`} />
      <Metric label="Key Levels" value={`$${data.keyLevels.putWall.strike}`} sub={`Put Wall (${(data.keyLevels.putWall.oi / 1000).toFixed(0)}K OI)`} />
    </div>
  )
}
