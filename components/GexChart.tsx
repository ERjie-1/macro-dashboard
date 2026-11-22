'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, CartesianGrid } from 'recharts'
import type { TickerOptions } from '@/types/positioning'
import { formatB } from '@/lib/format'
import { expiryRows } from '@/lib/positioningReading'

export default function GexChart({ gex, spot, asOf, selectedExpiry, onSelectExpiry }: { selectedExpiry?: string; onSelectExpiry: (expiry: string) => void; gex: TickerOptions['gex']; spot: number; asOf?: string }) {
  const strikes = gex.byStrike.filter(x => Number.isFinite(x.strike) && Number.isFinite(x.gex))
  const markers = [spot, gex.flipPrice].filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  const coordinates = [...strikes.map(x => x.strike), ...markers]
  const domain = coordinates.length ? [Math.min(...coordinates) * .99, Math.max(...coordinates) * 1.01] : [0, 1]
  const expiries = expiryRows({ gex }, asOf)
  return <div className="space-y-5 min-w-0">
    <div><h3 className="text-sm font-semibold">全链行权价净 Gamma · 绝对值前 40 档</h3>
      <p className="text-xs text-gray-500 mb-2">全链净额 {Number.isFinite(gex.total) ? formatB(gex.total) : 'N/A'}；下图是全链部分行权价，不随到期日切换；快照未提供逐日行权价 Gamma。</p>
      <div className="h-[270px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={strikes} margin={{ top: 22, right: 15, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" dataKey="strike" domain={domain} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
        <Tooltip formatter={v => [typeof v === 'number' ? formatB(v) : 'N/A', '净 Gamma']} labelFormatter={v => `行权价 $${v}`} />
        <ReferenceLine y={0} stroke="#64748b" />
        {Number.isFinite(spot) && <ReferenceLine x={spot} stroke="#111827" label={{ value: '现价', position: 'insideTopLeft', fontSize: 11 }} />}
        {typeof gex.flipPrice === 'number' && Number.isFinite(gex.flipPrice) && <ReferenceLine x={gex.flipPrice} stroke="#6366f1" strokeDasharray="4 4" label={{ value: 'Flip', position: 'top', fontSize: 11 }} />}
        <Bar dataKey="gex" maxBarSize={16}>{strikes.map(x => <Cell key={x.strike} fill={x.gex >= 0 ? '#14b8a6' : '#ef4444'} />)}</Bar>
      </BarChart></ResponsiveContainer></div>
    </div>
    <div><h3 className="text-sm font-semibold">到期日净 Gamma · 点击选择</h3><label className="text-xs">所选到期日 <select aria-label="选择到期日" value={selectedExpiry} onChange={e => onSelectExpiry(e.target.value)} className="border rounded p-1">{expiries.map(x => <option key={x.expiry} value={x.expiry}>{x.expiry}</option>)}</select></label><p className="text-xs text-gray-500">到期天数以收盘观测日 {asOf || '未知'} 为基准，使用日历天。</p>
      <div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={expiries} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="expiry" tickFormatter={v => v.slice(5)} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
        <Tooltip formatter={v => [typeof v === 'number' ? formatB(v) : 'N/A', '净 Gamma']} labelFormatter={v => { const row = expiries.find(x => x.expiry === v); return `${v} · ${row?.dte == null ? '天数未知' : `${row.dte} 日历天`}` }} />
        <ReferenceLine y={0} stroke="#64748b" />
        <Bar dataKey="gex" onClick={(_row, index) => { const row = expiries[index]; if (row) onSelectExpiry(row.expiry) }} cursor="pointer">{expiries.map(x => <Cell key={x.expiry} fill={x.gex >= 0 ? '#14b8a6' : '#ef4444'} stroke={x.expiry === selectedExpiry ? '#111827' : 'none'} strokeWidth={3} opacity={x.expiry === selectedExpiry ? 1 : .55} />)}</Bar>
      </BarChart></ResponsiveContainer></div>
    </div>
  </div>
}
