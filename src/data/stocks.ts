import type { Stock } from '../types'

const STOCK_SEEDS: Omit<Stock, 'priceHistory'>[] = [
  // 기술
  { id: 'SSEI', name: '사성전자',       sector: '기술', baseVolatility: 0.014, currentPrice: 288_900,   openPrice: 288_900,   high: 288_900,   low: 288_900,   volume: 0 },
  { id: 'MRCE', name: '미래자동차',     sector: '기술', baseVolatility: 0.018, currentPrice: 741_000,   openPrice: 741_000,   high: 741_000,   low: 741_000,   volume: 0 },
  { id: 'CHOC', name: '초콜릿',         sector: '기술', baseVolatility: 0.030, currentPrice: 42_400,    openPrice: 42_400,    high: 42_400,    low: 42_400,    volume: 0 },
  { id: 'SKYH', name: 'SKY 하이',       sector: '기술', baseVolatility: 0.012, currentPrice: 2_369_000, openPrice: 2_369_000, high: 2_369_000, low: 2_369_000, volume: 0 },
  { id: 'GLES', name: '굿럭전자',       sector: '기술', baseVolatility: 0.016, currentPrice: 372_500,   openPrice: 372_500,   high: 372_500,   low: 372_500,   volume: 0 },
  // 교육
  { id: 'MINC', name: '민코딩',         sector: '교육', baseVolatility: 0.030, currentPrice: 18_900,    openPrice: 18_900,    high: 18_900,    low: 18_900,    volume: 0 },
  { id: 'DKCD', name: '득코딩',         sector: '교육', baseVolatility: 0.025, currentPrice: 10_300,    openPrice: 10_300,    high: 10_300,    low: 10_300,    volume: 0 },
  { id: 'SGCP', name: '싱글캠퍼스',     sector: '교육', baseVolatility: 0.028, currentPrice: 25_000,    openPrice: 25_000,    high: 25_000,    low: 25_000,    volume: 0 },
  { id: 'CRZU', name: '크레이지 유니버스', sector: '교육', baseVolatility: 0.035, currentPrice: 8_900,   openPrice: 8_900,    high: 8_900,     low: 8_900,     volume: 0 },
  // 금융
  { id: 'DRBN', name: '두리은행',       sector: '금융', baseVolatility: 0.015, currentPrice: 115_700,   openPrice: 115_700,   high: 115_700,   low: 115_700,   volume: 0 },
  { id: 'SSSN', name: '사성증권',       sector: '금융', baseVolatility: 0.018, currentPrice: 127_600,   openPrice: 127_600,   high: 127_600,   low: 127_600,   volume: 0 },
  { id: 'NNBK', name: '너네은행',       sector: '금융', baseVolatility: 0.016, currentPrice: 29_600,    openPrice: 29_600,    high: 29_600,    low: 29_600,    volume: 0 },
  { id: 'GKMN', name: '국민금융',       sector: '금융', baseVolatility: 0.014, currentPrice: 153_100,   openPrice: 153_100,   high: 153_100,   low: 153_100,   volume: 0 },
  // 물류
  { id: 'CPNG', name: '콘팡',           sector: '물류', baseVolatility: 0.025, currentPrice: 19_600,    openPrice: 19_600,    high: 19_600,    low: 19_600,    volume: 0 },
  { id: 'NVRL', name: '네버라인',       sector: '물류', baseVolatility: 0.022, currentPrice: 25_700,    openPrice: 25_700,    high: 25_700,    low: 25_700,    volume: 0 },
  { id: 'CHMK', name: '체리마켓',       sector: '물류', baseVolatility: 0.018, currentPrice: 210_000,   openPrice: 210_000,   high: 210_000,   low: 210_000,   volume: 0 },
  // 게임
  { id: 'NEXT', name: '넥스트',         sector: '게임', baseVolatility: 0.040, currentPrice: 22_000,    openPrice: 22_000,    high: 22_000,    low: 22_000,    volume: 0 },
  { id: 'MKSF', name: 'MK소프트',       sector: '게임', baseVolatility: 0.025, currentPrice: 297_000,   openPrice: 297_000,   high: 297_000,   low: 297_000,   volume: 0 },
  { id: 'OBSD', name: '옵시디안',       sector: '게임', baseVolatility: 0.038, currentPrice: 43_200,    openPrice: 43_200,    high: 43_200,    low: 43_200,    volume: 0 },
  { id: 'GRUP', name: '기어업',         sector: '게임', baseVolatility: 0.042, currentPrice: 29_100,    openPrice: 29_100,    high: 29_100,    low: 29_100,    volume: 0 },
]

export function buildInitialStocks(): Stock[] {
  const t = Date.now()
  return STOCK_SEEDS.map(s => ({
    ...s,
    priceHistory: [{ timestamp: t, price: s.currentPrice }],
  }))
}
