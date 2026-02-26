'use client'

import { useState } from 'react'
import { Factor } from '@/types'
import { getStatusColor } from '@/lib/mockData'
import TrendChart from './TrendChart'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface FactorTableProps {
  factors: Factor[]
  title: string
  moduleColor: string
}

function ChangeArrow({ direction }: { direction: string }) {
  if (direction === 'up') return <span className="text-gray-400 mr-1">↗</span>
  if (direction === 'down') return <span className="text-gray-400 mr-1">↘</span>
  return <span className="text-gray-400 mr-1">→</span>
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

  return (
    <>
      <tr
        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Factor name */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{expanded ? '∨' : '›'}</span>
            <span className="text-sm text-gray-800">{factor.name}</span>
          </div>
        </td>
        {/* Value */}
        <td className="py-3 px-4 text-sm text-gray-700 font-medium">{factor.value}</td>
        {/* 7D Change */}
        <td className="py-3 px-4 text-sm text-gray-500">
          <ChangeArrow direction={factor.changeDirection} />
          {factor.sevenDayChange}
        </td>
        {/* Historical Percentile (5Y) */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${factor.historicalPercentile5Y}%`,
                  backgroundColor: moduleColor,
                }}
              />
            </div>
            <span className="text-xs text-gray-400">{factor.historicalPercentile5Y}th</span>
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
            />
          )}
        </td>
        {/* Velocity */}
        <td className="py-3 px-4">
          {isExtra ? (
            <span className="text-gray-300">—</span>
          ) : (
            <span className="text-xs text-gray-400">
              {factor.velocity === 'rising' ? '↑' : factor.velocity === 'falling' ? '↓' : '→'}
            </span>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Historical Trend */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Historical Trend (3M)
                </div>
                <div className="h-32">
                  <TrendChart
                    data={factor.trendData.slice(-90)}
                    color={moduleColor}
                    mini={true}
                  />
                </div>
              </div>
              {/* Right: Percentile Distribution */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Historical Percentile Distribution (5Y)
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={factor.percentileData}
                      margin={{ top: 4, right: 4, left: -20, bottom: 4 }}
                    >
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Bar dataKey="freq" radius={[2, 2, 0, 0]}>
                        {factor.percentileData.map((entry, index) => {
                          const pct = index * 10 + 5
                          const isCurrent =
                            pct >= factor.historicalPercentile5Y - 5 &&
                            pct < factor.historicalPercentile5Y + 5
                          return (
                            <Cell
                              key={index}
                              fill={isCurrent ? moduleColor : '#e5e7eb'}
                            />
                          )
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function FactorTable({ factors, title, moduleColor }: FactorTableProps) {
  const scored = factors.filter((f) => !f.isExtra)
  const extra = factors.filter((f) => f.isExtra)

  const renderTable = (rows: Factor[], isExtra: boolean) => (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-700">{isExtra ? 'Extra Factors' : title}</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left px-4 py-2 font-medium">Factor</th>
            <th className="text-left px-4 py-2 font-medium">Value</th>
            <th className="text-left px-4 py-2 font-medium">7D Change</th>
            <th className="text-left px-4 py-2 font-medium">
              Historical Percentile
              <br />
              (5Y)
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
  )

  return (
    <div className="space-y-4">
      {scored.length > 0 && renderTable(scored, false)}
      {extra.length > 0 && renderTable(extra, true)}
    </div>
  )
}
