'use client'

import FactorHistory from './FactorHistory'
import FactorChange from './FactorChange'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Factor, LiftDragItem, Module, Status } from '@/types'

const FACTOR_COLUMNS = 'grid grid-cols-[minmax(200px,2.2fr)_minmax(85px,0.9fr)_minmax(110px,1fr)_minmax(85px,0.85fr)_minmax(145px,1.25fr)_56px_44px] items-center px-4 py-2.5'

interface GlobalFactorOverviewProps {
  modules: Module[]
  scoreLift: LiftDragItem[]
  scoreDrag: LiftDragItem[]
  asOfTradingDate?: string
}

type SortKey = 'default' | 'lift' | 'drag' | 'pctl_asc' | 'pctl_desc'
type StatusFilter = 'all' | Status

interface EnrichedFactor {
  factor: Factor
  moduleName: string
  moduleSlug: string
  moduleColor: string
  alignedPctl: number
  contrib7D: number | null
  orderIndex: number
}

function statusDotClass(status: Status): string {
  if (status === 'supportive') return 'bg-emerald-500'
  if (status === 'neutral') return 'bg-amber-400'
  return 'bg-red-500'
}

function statusBarColor(status: Status): string {
  if (status === 'supportive') return '#16a34a'
  if (status === 'neutral') return '#d97706'
  return '#dc2626'
}

function ChangeArrow({ direction }: { direction: string }) {
  if (direction === 'up') return <span className="text-gray-400 mr-1">↗</span>
  if (direction === 'down') return <span className="text-gray-400 mr-1">↘</span>
  return <span className="text-gray-400 mr-1">→</span>
}

export default function GlobalFactorOverview({
  modules,
  scoreLift,
  scoreDrag,
  asOfTradingDate,
}: GlobalFactorOverviewProps) {
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('default')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const contribMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of scoreLift) {
      map.set(item.name, item.pts)
    }
    for (const item of scoreDrag) {
      map.set(item.name, -Math.abs(item.pts))
    }
    return map
  }, [scoreLift, scoreDrag])

  const allScored = useMemo<EnrichedFactor[]>(() => {
    const list: EnrichedFactor[] = []
    let idx = 0
    for (const m of modules) {
      for (const f of m.factors) {
        if (f.isExtra) continue
        const rawAligned = f.historicalPercentile5Y
        list.push({
          factor: f,
          moduleName: m.name,
          moduleSlug: m.slug,
          moduleColor: m.color,
          alignedPctl: Math.max(0, Math.min(100, rawAligned)),
          contrib7D: contribMap.has(f.name) ? (contribMap.get(f.name) ?? null) : null,
          orderIndex: idx++,
        })
      }
    }
    return list
  }, [modules, contribMap])

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of allScored) {
      counts.set(item.moduleSlug, (counts.get(item.moduleSlug) ?? 0) + 1)
    }
    return counts
  }, [allScored])

  const visibleRows = useMemo(() => {
    let rows = allScored
    if (selectedModule !== 'all') {
      rows = rows.filter((r) => r.moduleSlug === selectedModule)
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.factor.status === statusFilter)
    }
    const sorted = [...rows]
    switch (sortBy) {
      case 'lift':
        sorted.sort((a, b) => (b.contrib7D ?? -999) - (a.contrib7D ?? -999) || a.orderIndex - b.orderIndex)
        break
      case 'drag':
        sorted.sort((a, b) => (a.contrib7D ?? 999) - (b.contrib7D ?? 999) || a.orderIndex - b.orderIndex)
        break
      case 'pctl_asc':
        sorted.sort((a, b) => a.alignedPctl - b.alignedPctl || a.orderIndex - b.orderIndex)
        break
      case 'pctl_desc':
        sorted.sort((a, b) => b.alignedPctl - a.alignedPctl || a.orderIndex - b.orderIndex)
        break
      default:
        sorted.sort((a, b) => a.orderIndex - b.orderIndex)
    }
    return sorted
  }, [allScored, selectedModule, statusFilter, sortBy])

  const toggleExpand = (key: string) => {
    setExpandedIds((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="dial-card overflow-hidden" id="factor-overview">
      {/* Header & Controls */}
      <div className="p-5 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">
              Factor Overview{' '}
              <span className="text-gray-400 font-normal font-mono text-xs">
                ({visibleRows.length} / {allScored.length} scored)
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Filter by module or regime, sort by 7D score attribution or 5Y percentile, and click any row for trend &amp; distribution
            </p>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="factor-sort-select" className="text-gray-500 whitespace-nowrap">
              Sort by
            </label>
            <select
              id="factor-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:border-gray-400"
            >
              <option value="default">Default (Module)</option>
              <option value="lift">Score Lift (7D ↓)</option>
              <option value="drag">Score Drag (7D ↑)</option>
              <option value="pctl_asc">5Y Percentile (Low → High)</option>
              <option value="pctl_desc">5Y Percentile (High → Low)</option>
            </select>
          </div>
        </div>

        {/* Module filter pills + Status quick filter */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filter by module">
            <button
              type="button"
              onClick={() => setSelectedModule('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                selectedModule === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 bg-gray-100/80 hover:bg-gray-200/70'
              }`}
            >
              All ({allScored.length})
            </button>
            {modules.map((m) => {
              const count = moduleCounts.get(m.slug) ?? 0
              const active = selectedModule === m.slug
              return (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => setSelectedModule(active ? 'all' : m.slug)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 bg-gray-100/80 hover:bg-gray-200/70'
                  }`}
                >
                  {m.name} ({count})
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 text-xs">
            {(['all', 'supportive', 'neutral', 'restrictive'] as StatusFilter[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px]">
          <thead>
            <tr className="text-[11px] text-gray-400 uppercase tracking-wider bg-gray-50/60 border-b border-gray-100">
              <th colSpan={7} className="p-0 font-medium">
                <div className={FACTOR_COLUMNS}>
                  <span className="text-left">Factor</span>
                  <span className="text-left">Value</span>
                  <span className="text-left">7D Change</span>
                  <span className="text-right pr-3">7D Contrib</span>
                  <span className="text-left">5Y Percentile</span>
                  <span className="text-center">Status</span>
                  <span className="text-center">Vel</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row) => {
              const key = `${row.moduleSlug}-${row.factor.id}`
              const isExpanded = Boolean(expandedIds[key])
              const barColor = statusBarColor(row.factor.status)

              return (
                <tr key={key} className="group">
                  <td colSpan={7} className="p-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpand(key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleExpand(key)
                        }
                      }}
                      className={`${FACTOR_COLUMNS} hover:bg-gray-50/90 cursor-pointer transition-colors`}
                    >
                      {/* Factor + Module pill */}
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-gray-400 text-xs w-3 shrink-0">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <span className="text-sm text-gray-800 font-medium truncate">
                          {row.factor.name}
                        </span>
                        {selectedModule === 'all' && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500 font-medium">
                            {row.moduleName}
                          </span>
                        )}
                      </div>

                      {/* Value */}
                      <div className="text-sm font-mono text-gray-800 pr-2 truncate">
                        {row.factor.value}
                      </div>

                      {/* 7D Change */}
                      <div className="text-xs font-mono text-gray-500 pr-2 truncate">
                        <FactorChange factor={row.factor} asOf={asOfTradingDate} />
                      </div>

                      {/* 7D Contribution */}
                      <div className="text-right font-mono text-xs pr-3">
                        {row.contrib7D !== null ? (
                          <span
                            className={`font-medium ${
                              row.contrib7D > 0
                                ? 'text-emerald-600'
                                : row.contrib7D < 0
                                  ? 'text-red-600'
                                  : 'text-gray-400'
                            }`}
                          >
                            {row.contrib7D > 0 ? '+' : ''}
                            {row.contrib7D.toFixed(2)} pts
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>

                      {/* Direction-aligned 5Y Percentile bar */}
                      <div
                        className="flex items-center gap-2 pr-2"
                        title={`Historical percentile: ${row.alignedPctl}%`}
                      >
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${row.alignedPctl}%`,
                              backgroundColor: barColor,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-500 w-9">
                          {row.alignedPctl.toFixed(1)}%
                        </span>
                      </div>

                      {/* Status dot */}
                      <div className="flex justify-center">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${statusDotClass(row.factor.status)}`}
                          title={row.factor.status}
                        />
                      </div>

                      {/* Velocity */}
                      <div className="text-center text-xs text-gray-400 font-mono">
                        {row.factor.velocity === 'rising'
                          ? '↑'
                          : row.factor.velocity === 'falling'
                            ? '↓'
                            : '→'}
                      </div>
                    </div>

                    {/* In-place expansion preserving adjacent rows */}
                    {isExpanded && (
                      <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-4">
                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                          <div className="text-xs text-gray-500">
                            {row.factor.description || `${row.moduleName} scored factor`}
                          </div>
                          <Link
                            href={`/module/${row.moduleSlug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2"
                          >
                            Open {row.moduleName} detail →
                          </Link>
                        </div>

                        <FactorHistory factor={row.factor} color={barColor} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No scored factors match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
