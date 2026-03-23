import type { TickerOptions } from '@/types/positioning'

interface Props {
  data: TickerOptions
}

export default function KeyLevels({ data }: Props) {
  const { putWall, callWall, topLevels } = data.keyLevels

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Key OI Levels ({data.pcr.targetExpiry})</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-xs text-red-600 mb-1">Put Wall</div>
          <div className="text-lg font-bold text-red-700">${putWall.strike}</div>
          <div className="text-xs text-red-500">{(putWall.oi / 1000).toFixed(1)}K OI</div>
        </div>
        {data.gex.flipPrice && (
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <div className="text-xs text-indigo-600 mb-1">Gamma Flip</div>
            <div className="text-lg font-bold text-indigo-700">${data.gex.flipPrice}</div>
            <div className="text-xs text-indigo-500">GEX sign change</div>
          </div>
        )}
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <div className="text-xs text-emerald-600 mb-1">Call Wall</div>
          <div className="text-lg font-bold text-emerald-700">${callWall.strike}</div>
          <div className="text-xs text-emerald-500">{(callWall.oi / 1000).toFixed(1)}K OI</div>
        </div>
      </div>

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
