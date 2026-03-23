import type { Module } from '@/types'

interface Props {
  modules: Module[]
  dashboardUpdatedAt?: string
}

function hoursAgo(iso?: string): number | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  return diff / (1000 * 60 * 60)
}

function freshnessColor(hours: number | null): string {
  if (hours === null) return 'bg-gray-300'
  if (hours < 24) return 'bg-green-400'
  if (hours < 48) return 'bg-yellow-400'
  return 'bg-red-400'
}

function formatAge(hours: number | null): string {
  if (hours === null) return 'N/A'
  if (hours < 1) return '<1h ago'
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DataFreshness({ modules, dashboardUpdatedAt }: Props) {
  const dashboardHours = hoursAgo(dashboardUpdatedAt)

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Data Freshness</h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full ${freshnessColor(dashboardHours)}`} />
          <span>Dashboard: {formatAge(dashboardHours)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {modules.map((m) => {
          const hours = hoursAgo(m.updatedAt)
          return (
            <div key={m.slug} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${freshnessColor(hours)}`} />
              <div className="min-w-0">
                <div className="text-xs text-gray-600 truncate">{m.name}</div>
                <div className="text-xs text-gray-400">{formatAge(hours)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> &lt;24h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 24–48h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> &gt;48h</span>
      </div>
    </div>
  )
}
