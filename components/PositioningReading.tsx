import type { TickerOptions } from '@/types/positioning'
import { positioningReading } from '@/lib/positioningReading'
import { formatB } from '@/lib/format'

export default function PositioningReading({ data, asOf }: { data: TickerOptions; asOf?: string }) {
  const r = positioningReading(data, asOf)
  return <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
    <h3 className="font-semibold text-slate-900">这张图怎么读 · 收盘观测 {asOf || '未知'}</h3>
    <p><strong>① 先看到期集中：</strong>{r.largest ? `${r.largest.expiry} 的净 Gamma 绝对值最大（${formatB(r.largest.gex)}），占各到期日净 Gamma 绝对值之和的 ${r.share == null ? '未知' : (r.share * 100).toFixed(1) + '%'}。` : '暂无可用到期分布。'} 这是到期日之间的幅度占比，不是持仓比例，也不是 Frank 图中的 Normalized 指标。</p>
    <p><strong>② 再看价格附近：</strong>{r.peak ? `已展示行权价中，$${r.peak.strike} 的净敞口幅度最大（${formatB(r.peak.gex)}）。` : '暂无可用行权价分布。'} {r.flipText}</p>
    <p><strong>③ 分清持仓与价格判断：</strong>{data.pcr.targetExpiry} 到期的 Put / Call OI 峰在 ${data.keyLevels.putWall.strike} / ${data.keyLevels.callWall.strike}；Max Pain 为 ${data.maxPain}。它们描述持仓集中及到期赔付计算，不自动构成支撑、阻力或价格目标。</p>
    <p className="text-xs text-slate-500">模型按 Call 正、Put 负估算每 $1 价格变化的 Gamma 敞口；不是实际交易商净仓位。正负号用于观察模型结构，不能据此断言价格必然被压住或加速。成交、隐波和持仓变化后需重新计算。</p>
  </section>
}
