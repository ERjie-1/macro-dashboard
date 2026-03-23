export interface PositioningDashboard {
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
  spot: number
  gex: {
    total: number
    byExpiry: { expiry: string; gex: number; dte: number }[]
    byStrike: { strike: number; gex: number }[]
    flipPrice: number | null
  }
  pcr: {
    targetExpiry: string
    oiRatio: number
    volRatio: number
    allExpOiRatio: number
    allExpVolRatio: number
  }
  skew: {
    riskReversal25d: number
    putIV25d: number
    callIV25d: number
    atmIV: number
  }
  vrp: {
    iv: number
    hv21: number
    premium: number
  }
  maxPain: number
  keyLevels: {
    putWall: { strike: number; oi: number }
    callWall: { strike: number; oi: number }
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
