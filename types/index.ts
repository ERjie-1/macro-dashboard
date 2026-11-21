export type Status = 'supportive' | 'neutral' | 'restrictive'
export type ChangeDirection = 'up' | 'down' | 'flat'
export type Velocity = 'rising' | 'falling' | 'flat'
export type TrendDirection = 'improving' | 'declining' | 'stable'

export interface TrendPoint {
  date: string
  value: number
}

export interface PercentileBar {
  range: string
  freq: number
}

export interface Factor {
  id: string
  factorId?: string
  name: string
  value: string
  score?: number
  sevenDayChange: string
  changeDirection: ChangeDirection
  historicalPercentile5Y: number
  status: Status
  velocity: Velocity
  trendData: TrendPoint[]
  percentileData: PercentileBar[]
  isExtra: boolean
  description?: string
}

export interface Module {
  slug: string
  name: string
  score: number
  prevScore: number
  sevenDayChangePct: number
  trendDays: number
  trendDirection: TrendDirection
  percentile5Y: number
  lastUpdated: string
  updatedAt?: string
  color: string
  trendData: TrendPoint[]
  factors: Factor[]
}

export interface LiftDragItem {
  name: string
  pts: number
}

export interface MacroDashboard {
  calibrationVersion?: string
  asOfTradingDate?: string
  generatedAtUtc?: string
  generatedAtEt?: string
  sessionScope?: 'post_close' | 'intraday'
  sourceFreshness?: Record<string, { lastDate: string | null; lagTradingDays: number | null }>
  marketCloseInputs?: Record<string, unknown>
  scoredFactors?: Record<string, unknown>
  score: number
  prevScore: number
  trendDays: number
  trendDirection: TrendDirection
  percentile5Y: number
  lastUpdated: string
  updatedAt?: string
  trendData: TrendPoint[]
  modules: Module[]
  scoreLift: LiftDragItem[]
  scoreDrag: LiftDragItem[]
}
