export interface PositioningDashboard {
  calibrationVersion?: string
  asOfTradingDate?: string
  generatedAtUtc?: string
  generatedAtEt?: string
  sessionScope?: 'post_close' | 'intraday'
  sourceFreshness?: Record<string, unknown>
  updatedAt: string | null
  vixTermStructure: VixTermStructure
  skewIndex: SkewIndex
  options: Record<string, TickerOptions>
  cot: CotData
  etfFlows: Record<string, EtfFlow>
}

export interface VixTermStructure {
  points: { tenor: string; value: number }[]
  shape: 'contango' | 'backwardation' | 'mixed'
  vixPercentile1Y: number
  history90D: { date: string; vix: number; vix3m: number }[]
}

export interface SkewIndex {
  current: number
  percentile1Y: number
  history90D: { date: string; value: number }[]
}

export interface TickerOptions {
  expiryDetails?: Record<string, ExpiryDetail | null>
  spot: number
  gex: {
    total: number
    byExpiry: { expiry: string; gex: number; dte: number }[]
    byStrike: { strike: number; gex: number }[]
    flipPrice: number | null
  }
  pcr: {
    targetExpiry: string
    oiRatio: number | null
    volRatio: number | null
    allExpOiRatio: number | null
    allExpVolRatio: number | null
  }
  skew: {
    riskReversal25d: number | null
    putIV25d: number | null
    callIV25d: number | null
    atmIV: number | null
  }
  vrp: {
    iv: number | null
    hv21: number | null
    premium: number | null
  }
  maxPain: number | null
  keyLevels: {
    putWall: { strike: number; oi: number } | null
    callWall: { strike: number; oi: number } | null
    topLevels: { strike: number; type: 'put' | 'call'; oi: number }[]
  }
}

export interface CotData {
  asOfDate: string
  contracts: Record<string, CotContract>
}

export interface CotContract {
  name: string
  category: 'equity' | 'bond' | 'commodity' | 'fx'
  leveragedNet: number
  assetMgrNet: number
  dealerNet: number
  leveragedNetChg: number
  history: { date: string; leveragedNet: number; assetMgrNet: number }[]
}

export interface EtfFlow {
  name: string
  obv: number
  mfi14: number
  volumeVsAvg: number
  history30D: { date: string; obv: number; mfi: number }[]
}

export interface ExpiryDetail {
  keyLevels: { putWall: {strike: number; oi: number} | null; callWall: {strike: number; oi: number} | null; topLevels: TickerOptions['keyLevels']['topLevels'] }
  maxPain: number | null
  pcr: {targetExpiry: string; oiRatio: number | null; volRatio: number | null}
}
