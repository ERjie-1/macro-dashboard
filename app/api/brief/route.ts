import { NextResponse } from 'next/server'
import { dashboardData } from '@/lib/getData'

// In-memory cache: one brief per calendar day
let cached: { date: string; text: string } | null = null

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildPrompt(): string {
  const d = dashboardData
  const delta1D = d.score - d.prevScore
  const len = d.trendData.length
  const delta7D = len >= 7 ? d.score - d.trendData[len - 7].value : delta1D

  const moduleDeltas = d.modules
    .map((m) => ({ name: m.name, delta: m.score - m.prevScore, pct7d: m.sevenDayChangePct }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const topUp = moduleDeltas.filter((m) => m.delta > 0).slice(0, 2)
  const topDown = moduleDeltas.filter((m) => m.delta < 0).slice(0, 2)

  const liftNames = d.scoreLift.slice(0, 3).map((l) => `${l.name} (+${l.pts.toFixed(1)}pts)`)
  const dragNames = d.scoreDrag.slice(0, 3).map((l) => `${l.name} (${l.pts.toFixed(1)}pts)`)

  return `你是宏观经济环境分析师。请基于以下数据生成一段简洁的今日宏观环境简报（2-3句话，中文）。

数据：
- MEC总分：${d.score.toFixed(1)}/100（5年百分位：${d.percentile5Y}th）
- 1D变动：${delta1D >= 0 ? '+' : ''}${delta1D.toFixed(1)} pts
- 7D变动：${delta7D >= 0 ? '+' : ''}${delta7D.toFixed(1)} pts
- 趋势：${d.trendDays}天${d.trendDirection === 'improving' ? '改善' : d.trendDirection === 'declining' ? '下行' : '持平'}
- 1D上升模块：${topUp.map((m) => `${m.name}(${m.delta >= 0 ? '+' : ''}${m.delta.toFixed(1)})`).join(', ') || '无'}
- 1D下降模块：${topDown.map((m) => `${m.name}(${m.delta.toFixed(1)})`).join(', ') || '无'}
- 主要提振因素：${liftNames.join(', ')}
- 主要拖累因素：${dragNames.join(', ')}

要求：
1. 用专业但易懂的中文，像给基金经理的晨会简报
2. 点明总分变动方向和主要驱动因素
3. 指出值得关注的风险或改善信号
4. 不要列数字清单，用段落式叙述融合数据`
}

async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set')

  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) throw new Error(`DeepSeek ${resp.status}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function callKimi(prompt: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY
  if (!apiKey) throw new Error('KIMI_API_KEY not set')

  const resp = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) throw new Error(`Kimi ${resp.status}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function GET() {
  const today = todayKey()

  // Return cached if same day
  if (cached && cached.date === today) {
    return NextResponse.json({ text: cached.text, source: 'cache' })
  }

  const prompt = buildPrompt()

  // Try DeepSeek → Kimi → fallback
  let text = ''
  let source = 'mock'

  try {
    text = await callDeepSeek(prompt)
    source = 'deepseek'
  } catch {
    try {
      text = await callKimi(prompt)
      source = 'kimi'
    } catch {
      // Silent fallback — return empty, client uses mock
    }
  }

  if (text) {
    cached = { date: today, text }
  }

  return NextResponse.json({ text, source })
}
