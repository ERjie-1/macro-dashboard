'use client'

import FactorHistory from './FactorHistory'

import { useMemo, useState } from 'react'
import { Factor } from '@/types'
import { getStatusColor } from '@/lib/mockData'

interface FactorTableProps {
  factors: Factor[]
  title: string
  moduleColor: string
}

type ModuleSortKey = 'default' | 'pctl_asc' | 'pctl_desc' | 'name'

function ChangeArrow({ direction }: { direction: string }) {
  if (direction === 'up') return <span className="text-gray-400 mr-1">↗</span>
  if (direction === 'down') return <span className="text-gray-400 mr-1">↘</span>
  return <span className="text-gray-400 mr-1">→</span>
}

function getAlignedPercentile(factor: Factor): number {
  const raw = factor.historicalPercentile5Y
  return Math.max(0, Math.min(100, raw))
}

function FactorRow({
  factor,
  moduleColor,
  isExtra,
}: {
  factor: Factor
  moduleColor: string
  isExtra: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const statusColor = getStatusColor(factor.status)
  const displayPctl = isExtra
    ? Math.max(0, Math.min(100, factor.historicalPercentile5Y))
    : getAlignedPercentile(factor)

  return (
    <>
      <tr
        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Factor name */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-3 shrink-0">{expanded ? '▾' : '▸'}</span>
            <span className="text-sm text-gray-800 font-medium">{factor.name}</span>
          </div>
        </td>
        {/* Value */}
        <td className="py-3 px-4 text-sm font-mono text-gray-700 font-medium">{factor.value}</td>
        {/* 7D Change */}
        <td className="py-3 px-4 text-sm font-mono text-gray-500">
          <span title="Change units are not verified">N/A</span>
        </td>
        {/* Historical Percentile (5Y) */}
        <td
          className="py-3 px-4"
          title={
            isExtra
              ? `Raw 5Y percentile: ${factor.historicalPercentile5Y}th`
              : `Historical percentile: ${displayPctl}%`
          }
        >
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${displayPctl}%`,
                  backgroundColor: isExtra ? moduleColor : statusColor,
                }}
              />
            </div>
            <span className="text-xs font-mono text-gray-500">{displayPctl.toFixed(1)}%</span>
          </div>
        </td>
        {/* Status */}
        <td className="py-3 px-4">
          {isExtra ? (
            <span className="text-gray-300">—</span>
          ) : (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: statusColor }}
              title={factor.status}
            />
          )}
        </td>
        {/* Velocity */}
        <td className="py-3 px-4">
          {isExtra ? (
            <span className="text-gray-300">—</span>
          ) : (
            <span className="text-xs font-mono text-gray-400">
              {factor.velocity === 'rising' ? '↑' : factor.velocity === 'falling' ? '↓' : '→'}
            </span>
          )}
        </td>
      </tr>

      {/* Expanded detail row (in-place, preserving adjacent rows) */}
      {expanded && (
        <tr className="bg-gray-50/90">
          <td colSpan={6} className="px-6 py-4">
            {factor.description && (
              <p className="text-xs text-gray-500 mb-3">{factor.description}</p>
            )}
            <FactorHistory factor={factor} color={isExtra ? moduleColor : statusColor} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function FactorTable({ factors, title, moduleColor }: FactorTableProps) {
  const [sortBy, setSortBy] = useState<ModuleSortKey>('default')

  const scored = useMemo(() => {
    const base = factors.filter((f) => !f.isExtra)
    const copy = [...base]
    if (sortBy === 'pctl_asc') {
      copy.sort((a, b) => getAlignedPercentile(a) - getAlignedPercentile(b))
    } else if (sortBy === 'pctl_desc') {
      copy.sort((a, b) => getAlignedPercentile(b) - getAlignedPercentile(a))
    } else if (sortBy === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name))
    }
    return copy
  }, [factors, sortBy])

  const extra = useMemo(() => factors.filter((f) => f.isExtra), [factors])

  const renderTable = (rows: Factor[], isExtra: boolean) => (
    <div className="dial-card overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            {isExtra ? 'Display-Only Factors' : title}{' '}
            <span className="text-xs font-normal font-mono text-gray-400">({rows.length})</span>
          </h3>
          {isExtra && (
            <p className="text-xs text-gray-400 mt-0.5">
              Informational series shown for context — excluded from module score
            </p>
          )}
        </div>
        {!isExtra && rows.length > 1 && (
          <select
            aria-label="Sort module factors"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ModuleSortKey)}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 focus:outline-none focus:border-gray-400"
          >
            <option value="default">Default order</option>
            <option value="pctl_asc">5Y Percentile (Low → High)</option>
            <option value="pctl_desc">5Y Percentile (High → Low)</option>
            <option value="name">Name (A → Z)</option>
          </select>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium">Factor</th>
              <th className="text-left px-4 py-2 font-medium">Value</th>
              <th className="text-left px-4 py-2 font-medium">7D Change</th>
              <th className="text-left px-4 py-2 font-medium">
                Historical Percentile (5Y)
              </th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Velocity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((factor) => (
              <FactorRow
                key={factor.id}
                factor={factor}
                moduleColor={moduleColor}
                isExtra={isExtra}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {scored.length > 0 && renderTable(scored, false)}
      {extra.length > 0 && renderTable(extra, true)}
    </div>
  )
}
