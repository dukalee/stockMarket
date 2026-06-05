export type Sector = '기술' | '교육' | '금융' | '물류' | '게임'
export type GamePhase = 'setup' | 'playing' | 'advancing'
export type Sentiment = 'bullish' | 'bearish' | 'neutral'

export interface Stock {
  id: string
  name: string
  sector: Sector
  baseVolatility: number
  currentPrice: number
  openPrice: number
  high: number
  low: number
  volume: number
  priceHistory: PricePoint[]
}

export interface PricePoint {
  timestamp: number
  price: number
  quarterLabel?: string  // 분기 전환 시점에만 존재 (예: 'Y1Q1')
}

export interface NewsArticle {
  id: string
  quarter: string
  headline: string
  subheadline: string
  body: string
  summary: string          // 1~2줄 핵심 요약 (admin 전용)
  author: string
  publishedAt: string
  affectedSymbols: string[]
  sentiment: Sentiment
  strength: 'slight' | 'moderate' | 'strong'
  isSurprise: boolean
  isInverted: boolean
  priceImpact: Record<string, number>
  targetType: 'global' | 'local'
  targetSector?: string    // global일 때 영향 섹터
}

export interface CounterArticle {
  headline: string
  subheadline: string
  body: string
  author: string
  publishedAt: string
  originalHeadline: string  // 반박 대상 기사 제목
}

export interface Position {
  stockId: string
  shares: number
  averageCost: number
}

export interface Transaction {
  id: string
  stockId: string
  type: 'buy' | 'sell'
  shares: number
  pricePerShare: number
  totalValue: number
  quarter: string
  timestamp: number
}
