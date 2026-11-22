import { selectedExpiryDetails } from '@/lib/positioningReading'
import type { TickerOptions } from '@/types/positioning'

interface Props {
  selectedExpiry: string
  data: TickerOptions
}

export default function KeyLevels({ data, selectedExpiry }: Props) {
  const detail = selectedExpiryDetails(data, selectedExpiry)
  if (!detail) return <div><h3 className="font-semibold">Key OI Levels ({selectedExpiry})</h3><p className="text-sm text-gray-500 mt-3">本批快照该到期日明细未提供或含缺失OI，Put / Call OI 峰、完整排名及 Max Pain 无法核定；不使用其他日期代替。</p></div>
  const { putWall, callWall, topLevels } = detail.keyLevels

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Key OI Levels ({selectedExpiry})</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-xs text-red-600 mb-1">Put OI 峰</div>
          <div className="text-lg font-bold text-red-700">{putWall ? `$${putWall.strike}` : '无峰（OI为零）'}</div>
          <div className="text-xs text-red-500">{putWall ? `${(putWall.oi / 1000).toFixed(1)}K OI` : '0 OI'}</div>
        </div>
        {data.gex.flipPrice != null && (
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <div className="text-xs text-indigo-600 mb-1">Gamma Flip · 全链</div>
            <div className="text-lg font-bold text-indigo-700">${data.gex.flipPrice}</div>
            <div className="text-xs text-indigo-500">不随所选日期切换</div>
          </div>
        )}
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <div className="text-xs text-emerald-600 mb-1">Call OI 峰</div>
          <div className="text-lg font-bold text-emerald-700">{callWall ? `$${callWall.strike}` : '无峰（OI为零）'}</div>
          <div className="text-xs text-emerald-500">{callWall ? `${(callWall.oi / 1000).toFixed(1)}K OI` : '0 OI'}</div>
        </div>
      </div>

      {data.gex.flipPrice == null && <p className="text-xs text-gray-500 mb-3">Gamma Flip：现价 ±10% 扫描范围内未找到。</p>}
      {topLevels.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b">
              <th className="text-left py-1">Strike</th>
              <th className="text-left py-1">Type</th>
              <th className="text-right py-1">Open Interest</th>
            </tr>
          </thead>
          <tbody>
            {topLevels.slice(0, 8).map((level, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-1.5 font-medium">${level.strike}</td>
                <td className="py-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${level.type === 'put' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {level.type.toUpperCase()}
                  </span>
                </td>
                <td className="py-1.5 text-right text-gray-600">{(level.oi / 1000).toFixed(1)}K</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
