import { Factor } from '@/types'

interface FactorsOverviewProps {
  factors: Factor[]
}

export default function FactorsOverview({ factors }: FactorsOverviewProps) {
  const scored = factors.filter((f) => !f.isExtra)
  const supportive = scored.filter((f) => f.status === 'supportive').length
  const neutral = scored.filter((f) => f.status === 'neutral').length
  const restrictive = scored.filter((f) => f.status === 'restrictive').length

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Factors Overview</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{supportive}</div>
          <div className="text-xs text-gray-400 mt-1 tracking-wide uppercase">Supportive</div>
        </div>
        <div className="border border-gray-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{neutral}</div>
          <div className="text-xs text-gray-400 mt-1 tracking-wide uppercase">Neutral</div>
        </div>
        <div className="border border-gray-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{restrictive}</div>
          <div className="text-xs text-gray-400 mt-1 tracking-wide uppercase">Restrictive</div>
        </div>
      </div>
    </div>
  )
}
