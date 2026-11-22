import type { TickerOptions } from '@/types/positioning'
import { positioningReading, expiryRows, selectedExpiryDetails, gammaStructure } from '@/lib/positioningReading'
import { formatB } from '@/lib/format'

export default function PositioningReading({ data, asOf, selectedExpiry }: { selectedExpiry: string; data: TickerOptions; asOf?: string }) {
  const r = positioningReading(data, asOf)
  const rows = expiryRows(data, asOf)
  const selected = rows.find(x => x.expiry === selectedExpiry)
  const mass = rows.reduce((sum, x) => sum + Math.abs(x.gex), 0)
  const detail = selectedExpiryDetails(data, selectedExpiry)
  return <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
    <h3 className="font-semibold text-slate-900">这张图怎么读 · 收盘观测 {asOf || '未知'}</h3>
    <p><strong>整体结构：</strong>{gammaStructure(data)}</p>
    <p><strong>① 所选到期日：</strong>{selected ? `${selected.expiry} 的净 Gamma 为 ${formatB(selected.gex)}（${selected.gex > 0 ? '正' : selected.gex < 0 ? '负' : '零'}），占各到期日净 Gamma 绝对值之和的 ${mass > 0 ? (Math.abs(selected.gex) / mass * 100).toFixed(1) + '%' : '未知'}，距收盘观测日 ${selected.dte ?? '未知'} 个日历天。` : '该日没有可用的净 Gamma。'} 这是幅度占比，不是持仓比例。</p>
    <p><strong>② 再看价格附近：</strong>{r.peak ? `已展示行权价中，$${r.peak.strike} 的净敞口幅度最大（${formatB(r.peak.gex)}）。` : '暂无可用行权价分布。'} {r.flipText}</p>
    <p><strong>③ 所选日期的持仓：</strong>{detail ? `${selectedExpiry} 的 Put / Call OI 峰在 ${detail.keyLevels.putWall ? '$' + detail.keyLevels.putWall.strike : '无峰（OI为零）'} / ${detail.keyLevels.callWall ? '$' + detail.keyLevels.callWall.strike : '无峰（OI为零）'}，Max Pain 为 ${detail.maxPain == null ? '未知' : '$' + detail.maxPain}。` : `${selectedExpiry} 的 OI 峰、完整排名及 Max Pain 因缺失明细或OI暂不可核定。`} 持仓集中不自动构成支撑、阻力或价格目标。上方PCR指标仍按其标示日期；价格附近与Flip采用全链范围。</p>
    <p className="text-xs text-slate-500">模型按 Call 正、Put 负估算每 $1 价格变化的 Gamma 敞口；不是实际交易商净仓位。正负号用于观察模型结构，不能据此断言价格必然被压住或加速。成交、隐波和持仓变化后需重新计算。</p>
  </section>
}
