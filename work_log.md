# Macro Dashboard — Work Log

## 2026-02-27

### Session 1：项目搭建
- 初始化 Next.js 16 App Router + Tailwind CSS 项目结构
- 创建 7 个模块、TypeScript 类型系统（`types/index.ts`）
- 实现核心组件：`GaugeDial`、`TrendChart`、`ModuleCard`、`FactorTable`、`ScoreLiftDrag`、`FactorsOverview`
- 用 Mock 数据驱动初版 UI

### Session 2：Python 数据脚本
- 编写 `data/fetch_data.py`：拉取 FRED + Yahoo Finance 数据，计算衍生因子，评分，输出 `dashboard.json`
- 实现 5Y 历史百分位排名评分 + INVERT_FACTORS 集合
- 创建 `data/requirements.txt`
- 配置 GitHub Actions 每日 UTC 20:00 自动刷新数据

### Session 3：Vercel 部署 & 数据对接
- **修复**：`getData.ts` 从 JSON 静态 import 改为 `fs.readFileSync`（Turbopack 不支持 `public/` 模块 import）
- Force-commit seed `dashboard.json` 解决 Vercel build 时文件缺失
- 创建 `.github/workflows/refresh-data.yml` CI/CD 流水线
- 部署成功至 Vercel（https://github.com/ERjie-1/macro-dashboard）

### Session 4：评分算法校准（对照 bhadial.com）
通过逐因子反推对比，发现并修复 8 个 bug：

| # | 因子 | 问题 | 修复 |
|---|------|------|------|
| 1 | `collateral-repo-friction` | 未反转：SOFR>OBFR=回购压力=限制性 | 加入 INVERT_FACTORS |
| 2 | `dxy` | 未反转：强美元=全球融资收紧=限制性 | 加入 INVERT_FACTORS |
| 3 | `10y-breakeven` | 未反转：高通胀预期=worse conditions | 加入 INVERT_FACTORS |
| 4 | `curve-curvature` | 错误反转：bhadial 低曲率=限制性 | 移出 INVERT_FACTORS |
| 5 | `wti-oil` | 错误反转：bhadial 低油价=需求弱=限制性 | 移出 INVERT_FACTORS |
| 6 | `10y-rate-volatility` | 单位错误：DGS10 为小数，结果偏低 15.6x | `dgs10.diff()*100`，不年化 |
| 7 | `funding-fragmentation` | 量级错误：spread 未乘 100，偏小 500x | spreads `*100` 后再计算 rolling std |
| 8 | `rrp_rate` | 近似错误：ON RRP ≈ IORB-5bps（实际-15bps）| 改为 `iorb - 0.0015` |

**校准后分数**（2026-02-27）：Overall 47.0 \| Liquidity 23.6 \| Funding 19.7 \| Treasury 65.2 \| Rates 71.1 \| Credit 63.5 \| Risk 54.2 \| External 46.1

**对比 bhadial.com（同日）**：Overall 51.1 \| Rates 70.2 ✓（差 0.4，接近完美）

残差分析：Funding 差 22pt（2021 超额流动性拉低历史百分位）；Credit/Risk 差 10pt（市场时差）。

### Session 5：UI 对齐 bhadial.com
- 新增 `updatedAt` ISO 时间戳字段（fetch_data.py + types）
- 新增 `components/RelativeTime.tsx` 客户端组件（"Xh ago" / "Xd ago" 动态更新）
- 主页和模块详情页时间戳从 "Updated Feb 27, 2026" 改为相对时间格式

### Session 6：UI 重构 + 因子级权重校准

**Part 1: UI 对齐**
- `globals.css`：移除 `font-family: Arial, STKaiti` 覆盖 + 移除 dark mode CSS → Geist Sans 为唯一字体
- `ModuleCard.tsx`：重构布局（名称左上 + 分数右上 text-4xl + 7D 变化右对齐在下方）
- `TrendChart.tsx`：LineChart → AreaChart（半透明渐变填充），period 非活跃按钮加细边框

**Part 2: 数值校准**
- `MODULE_WEIGHTS` 改为等权 1/7（验证 bhadial = 简单平均）
- 逆向工程 bhadial API（`https://macro-dashboard-backend-f0x7.onrender.com/api/v1`），获取全部因子权重和百分位
- 添加 `FACTOR_WEIGHTS` 字典（每模块内因子加权），替换原来的因子等权平均
- `build_module_obj` / overall TS / lift-drag 归因全部改用因子加权
- 保存 bhadial 参考数据至 `data/bhadial_reference.json`

**关键发现**：bhadial API 的 `direction=null` 不代表不反转（10Y Breakeven pctl=79.6 证实内部反转）

**校准后分数**（因子加权后）：Overall 49.3 | Liquidity 26.4 | Funding 19.9 | Treasury 67.7 | Rates 67.6 | Credit 67.0 | Risk 51.4 | External 45.2

### Session 6b：逐因子百分位对比（完成）

逐模块对比我们的因子百分位 vs bhadial 精确百分位，定位偏差来源。

**Liquidity（+6pt）→ 结论：数据时差，无需改代码**
- bhadial 2/26 快照用的是 2/18 周报数据（TGA=912.7B），我们 2/27 用了 2/25 最新数据（TGA=839.0B）
- TGA 一周内降了 $73B，导致 TGA Deviation 和 Net Liq 值完全不同
- 周频 FRED 数据（WALCL, WDTGAL, WRESBAL）的发布延迟是差异根源
- 已验证 daily vs weekly 频率对百分位计算无影响（差 <0.5pt）

**Funding（-22pt）→ 结论：算法差异，非简单调参可修**
- Corridor Friction 1/2：raw values 一致（+2bps），但我们 raw_pct=94.4 vs bhadial 65.6。原因：5Y 数据中 81% 是 2021 QE 期间 -10～-12bps，当前 +2bps 数学上确实排 94th。即使缩窗到 3.5Y 或排除 2021 也无改善（~93%）。bhadial 可能用了 z-score 归一化或分段百分位
- Fragmentation：raw value 完全不同（我们 0.023 vs bhadial 0.103），计算公式有根本差异
- CP-TBill：raw value 不同（我们 -0.03% vs bhadial 0.06%），DCPF3M 数据延迟
- 需要多天 bhadial 数据来反推其 corridor friction 的百分位算法

**Treasury（+9.3pt）→ 结论：百分位算法差异，同 Funding**
- 30Y-10Y Term Premium：90.7 vs 92.2 (-1.5) ✓ 到位
- 10Y Rate Volatility：88.7 vs 51.0 (+37.7) — raw value 不同（我们 0.037 vs bhadial 0.091）。尝试 pct returns*10 方法可匹配 raw value 但百分位更差（94.7）。bhadial 百分位算法与 rank-based percentile 有根本差异
- Curve Curvature：16.3 vs 30.1 (-13.8) — raw value 一致（0.05 pct points），百分位窗口/算法不同
- 两个偏差因子均指向 bhadial 使用非 rank-based 百分位（可能 z-score 或分段归一化）

**Credit（-6.6pt）→ 结论：百分位算法差异**
- NFCI：83.1 vs 83.1 (0.0) ✓ 完美匹配
- HY Credit：38.2 vs 60.4 (-22.1) — log returns 和 simple returns 结果相同，计算方法无误，百分位归一化差异
- IG Credit：45.1 vs 57.4 (-12.3) — 同上
- Regional Banks vs SPY：87.4 vs 80.5 (+6.9) — 数据时差可解释

**Risk（-6.8pt）→ 结论：系统性百分位偏差**
- VIX：43.8 vs 49.2 (-5.4) — 中等偏差
- VIX Term Structure：42.2 vs 50.3 (-8.0) — 中等偏差
- Risk vs Safe：32.4 vs 43.1 (-10.8) — 最大缺口
- High-Beta：98.2 vs 97.5 (+0.7) ✓ 极端百分位处两种算法差异小
- 4 个因子全部偏低 5-11pt，确认 rank-based percentile vs bhadial 算法的系统性差异

**External（-5.4pt）→ 结论：Natural Gas 数据源不同 + 百分位偏差**
- DXY：76.1 vs 77.1 (-1.0) ✓ 基本到位
- FX Realized Vol：83.7 vs 77.2 (+6.5) — 轻微百分位偏差
- WTI Oil：20.3 vs 29.0 (-8.7) — 中等百分位偏差 + 数据时差
- Oil Vol Deviation：2.4 vs 2.8 (-0.4) ✓ 近乎完美
- **Natural Gas：48.7 vs 100.0 (-51.3)** — bhadial score=100 表示 NG 在 0th percentile（最低），但 Henry Hub $3.13 在 5Y 分布（$1.21-$30.72）中排 51st，绝不可能是 0th。bhadial 可能使用不同数据源（NG 期货波动率或 spread 指标）

---

## 已知问题 & 残差（Session 6b 完成）

| 模块 | 我们 vs bhadial | 差距 | 根因 |
|------|----------------|------|------|
| Liquidity | 26.4 vs 20.4 | +6.0 | FRED 周频数据时差（TGA 一周降 $73B） |
| **Funding** | **19.9 vs 41.9** | **-22.0** | 百分位算法差异 + 2021 QE 极端期污染 |
| Treasury | 67.7 vs 58.4 | +9.3 | 10Y Vol 计算/百分位差异 + Curvature 百分位差异 |
| Rates | 67.6 vs 70.2 | -2.6 | ✓ 基本到位 |
| Credit | 67.0 vs 73.6 | -6.6 | HY/IG 百分位算法差异（计算方法已验证正确） |
| Risk | 51.4 vs 58.2 | -6.8 | 系统性百分位偏差（4 因子全部偏低 5-11pt） |
| External | 45.3 vs 50.7 | -5.4 | Natural Gas 数据源不同 (-51pt) + 百分位偏差 |

### 全局结论（Session 6b）

逐模块逐因子对比后，偏差来源归为 3 类：
1. **FRED 数据时差**（Liquidity +6pt）：周频数据发布延迟，无需修复
2. **百分位归一化算法差异**（Funding -22pt, Treasury +9pt, Credit -7pt, Risk -7pt）：bhadial 可能使用 z-score 归一化或分段百分位，而非 scipy `percentileofscore(kind="rank")`。多模块呈现系统性偏差（我们偏低 5-10pt），需多天 bhadial 数据反推
3. **数据源/公式差异**（External NG -51pt, Funding Fragmentation -68pt）：bhadial 使用不同指标或计算方式

**下一步**：收集 7-15 天 bhadial API 快照，用时间序列回归反推百分位算法参数

### 踩坑备忘
- bhadial API `direction=null` ≠ 不反转（10Y Breakeven 确认内部做了反转）
- 因子等权 vs 因子加权差异巨大（Rates 从 71→52 再回 67，全因 breakeven 权重 0.35 + real_rate 0.50）
- bhadial 后端：Render + Supabase，前端 Vite+React SPA，数据通过 `/api/v1` REST API 提供
- 10Y Rate Vol: `diff()*100` vs `pct_change()*10` 都无法同时匹配 raw value 和百分位
- Natural Gas: Henry Hub spot price 在 5Y 分布中排 51st，但 bhadial 给 0th，数据源必然不同

---

## 2026-03-16

### Session 7：Positioning & Flow 新 Tab

**Part 1: 规划与 Codex Review**
- 设计完整方案：期权链分析（GEX/PCR/Skew/VRP/MaxPain/OI Wall）+ CFTC COT 持仓 + ETF 资金流
- 经 Codex 3 轮 review 修正：GEX 符号约定（per-$1-move, dealer hedge flow）、Gamma Flip 算法（假设 spot 迭代法而非 strike 累积）、DST 时区问题（cron 改 UTC 21:30）、冷启动 sentinel（updatedAt: null）、全到期日聚合口径、COT 历史内嵌策略
- bhadial API 采集改为手动（避免留痕）

**Part 2: 技术债务清理**
- 提交未 commit 的 UI 改动（趋势图颜色动态化、GaugeDial 圆角、TrendChart gradient ID 冲突修复）
- bhadial_snapshots.json 纳入 git track
- GitHub Actions 近 10 天全部成功运行

**Part 3: Python 数据管道 `data/fetch_positioning.py`**
- 期权链：yfinance 拉 SPY/QQQ/IWM 所有 expiry（~30个），Black-Scholes 计算 Gamma/Delta
- GEX：向量化 numpy 计算，符号约定 call 正 put 负，Flip 用假设 spot 迭代 + 线性插值
- PCR：双维度（月度 OPEX + 全到期日聚合），OI 和 Volume 各一
- 25Δ Skew：线性插值找 delta≈0.25 的 call/put，Risk Reversal = put IV - call IV
- VRP：ATM IV - HV21（60d 历史数据一次性拉取，复用给 VRP 避免重复 API 调用）
- Max Pain：向量化 numpy dot product（原 O(n²) Python loops）
- Key Levels：Put Wall / Call Wall / Top 10 OI
- VIX 期限结构：9D/30D/3M/6M/1Y 批量下载 + CBOE SKEW index
- CFTC COT：Financial Futures 报告（ES/NQ/ZN/ZB/6E）+ Disaggregated 报告（GC/CL），修复 403 Forbidden（加 User-Agent header），列名映射正确
- ETF 资金流：OBV / MFI(14D) / Volume vs 20D Avg，7 个 ETF

**Part 4: 前端**
- 顶部 Tab 导航（Macro Conditions / Positioning & Flow）
- 8 个新组件：TabNav, VixCurve, GexChart, OptionsMetrics, OptionsSection, KeyLevels, CotSection, EtfFlowGrid
- TypeScript 类型系统 `types/positioning.ts`
- 冷启动保护：种子文件 updatedAt=null → getPositioningData() 返回 null → fallback UI

**Part 5: CI/CD**
- GitHub Actions cron 从 UTC 20:00 改为 21:30（全年 DST-safe）
- 新增 fetch_positioning.py 步骤 + positioning.json 提交

**Part 6: Simplify 代码审阅**
- 提取共享 `lib/format.ts`（消除 formatB 重复）
- GexChart 改用 `TickerOptions['gex']` 类型（消除本地重复接口）
- 删除死代码（OptionsMetrics 的 gexColor、fetch_positioning.py 的 _empty_cot）
- 向量化 compute_gex() 和 compute_max_pain()
- 消除 VRP 重复 API 调用（fetch_option_chains 拉 60d 复用）
- VIX6M/VIX1Y 纳入批量下载
- 修复 _parse_cot_contract 的脆弱 date column fallback

**数据验证结果**（2026-03-15 快照）：
| Ticker | GEX | Flip | PCR OI (OPEX) | 25Δ Skew | VRP | Max Pain |
|--------|-----|------|---------------|----------|-----|----------|
| SPY | -$2.13B | $684.64 | 2.48 | 9.8 | +14.47 | $835 |
| QQQ | -$0.88B | $611.01 | 1.48 | 8.7 | +13.11 | $656 |
| IWM | -$1.36B | $265.10 | 2.81 | 12.2 | +16.94 | $254 |

与 Oreo 3/9 周报对比：三大指数全面负 Gamma 一致，IWM PCR Vol 极端（5.37）和 Skew 最高（12.2）符合"IWM 最脆弱"的判断。

### 踩坑备忘（Session 7 新增）
- python3.12 Framework 安装在 macOS 上有代码签名问题（numpy/pyexpat dlopen 失败）→ 用 `brew install python@3.12` 创建 venv 解决
- CFTC 数据分两个报告：Financial Futures（`fut_fin_txt_YYYY.zip`，有 Lev/AM/Dealer）用于股指/债券/FX；Disaggregated（`fut_disagg_txt_YYYY.zip`，有 M_Money/Swap）用于商品
- CFTC 下载需要 User-Agent header，否则 403 Forbidden
- E-mini S&P 500 的 CFTC 代码是 `13874A`，在 Financial Futures 报告里而非 Disaggregated
- yfinance `Ticker.options` 返回所有 expiry（含 2 年后的），远期对 GEX 影响极小（gamma ∝ 1/√T）
- Gamma Flip 不能用 strike 累积法——必须在假设 spot 上重算全链 BS gamma

---

## 技术备忘

- **Python 环境**：本地用 Homebrew python3.12 venv（`/tmp/macro-venv-hb/`），CI 用 python 3.11；Framework python3.12 有签名问题不可用
- **macOS SSL**：`ssl._create_unverified_context`，已加 `platform.system() == "Darwin"` 判断
- **git 强制提交 gitignored 文件**：`git add -f public/data/dashboard.json`
- **Vercel 触发**：每次 push main 自动重新部署
- **GitHub Actions secrets**：`GH_PAT`（推送权限）+ `FRED_API_KEY`
