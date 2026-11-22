'use client'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Factor } from '@/types'
import { factorHistory } from '@/lib/factorHistory'

const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 4 })
export default function FactorHistory({ factor, color }: { factor: Factor; color: string }) {
  const { points, domain, min, max } = factorHistory(factor.trendData)
  const p = factor.historicalPercentile5Y
  const valid = Number.isFinite(p) && p >= 0 && p <= 100
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Historical Trend · {points.length} observations</h4>
      <p className="text-xs text-gray-500 mb-2">{points[0]?.date} – {points.at(-1)?.date} · 原始数值，自适应纵轴</p>
      {points.length ? <div className="h-[210px]"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" minTickGap={35} tick={{ fontSize: 10 }} />
          <YAxis domain={domain} width={74} tick={{ fontSize: 10 }} tickFormatter={number} tickCount={5} />
          <Tooltip labelFormatter={v => String(v)} formatter={v => [typeof v === 'number' ? number(v) : 'N/A', factor.name]} />
          <Line type="linear" dataKey="value" stroke={color} strokeWidth={1.7} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer></div> : <p className="text-sm text-gray-500">暂无历史序列</p>}
      {min != null && max != null && <p className="text-xs text-gray-500">区间最低 {number(min)} · 最高 {number(max)}{min === max ? ' · 本期观测值相同' : ''}</p>}
    </div>
    <div className="min-w-0 space-y-3">
      <h4 className="text-xs font-semibold text-gray-700">Current Historical Percentile · 5Y</h4>
      <p className="text-2xl font-semibold" style={{ color }}>{valid ? `${p.toFixed(1)}%` : 'N/A'}</p>
      <div className="relative h-4 bg-gray-200 rounded" role="img" aria-label={valid ? `Historical percentile ${p.toFixed(1)} percent` : 'Historical percentile unavailable'}>
        {valid && <span className="absolute top-[-4px] h-6 w-1 -translate-x-1/2 rounded" style={{ left: `${p}%`, backgroundColor: color }} />}
      </div>
      <div className="flex justify-between text-xs text-gray-500"><span>0 · 历史低位</span><span>50</span><span>100 · 历史高位</span></div>
      <p className="text-sm text-gray-600">{valid ? `当前值处于过去五年样本的第 ${p.toFixed(1)} 百分位。` : '当前历史位置未知。'}这是原始数值的位置，高低不直接代表宏观环境好坏。</p>
      <p className="text-xs text-gray-500">原来的柱图按十分位等频分桶，柱高接近是分桶结果，并非原始数值分布；此处改为显示当前历史位置。</p>
    </div>
  </div>
}
