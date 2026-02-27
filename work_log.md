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

---

## 已知问题 & 残差

| 模块 | 我们 vs bhadial | 原因 |
|------|----------------|------|
| Funding | 差 ~22pt | corridor-friction-1 历史百分位受 2021 极端宽松压制 |
| Credit | 差 ~10pt | 市场时差（bhadial 截图比我们早 17h）|
| Risk | 差 ~10pt | VIX 上涨 + 权益表现变差 |
| External | 差 ~5pt | DHHNGSP 天然气 FRED 数据有延迟 |

---

## 技术备忘

- **Python 环境**：用 `python3.12`（Homebrew 3.14 有 PEP 668 限制无法 pip install）
- **macOS SSL**：`ssl._create_unverified_context`，已加 `platform.system() == "Darwin"` 判断
- **git 强制提交 gitignored 文件**：`git add -f public/data/dashboard.json`
- **Vercel 触发**：每次 push main 自动重新部署
- **GitHub Actions secrets**：`GH_PAT`（推送权限）+ `FRED_API_KEY`
