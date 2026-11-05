import type { Stock } from '../types'
import { createRng, randomRng } from '../utils/seededRandom'

const STOCK_SEEDS: Omit<Stock, 'priceHistory'>[] = [
  // 기술
  { id: 'SSEI', name: '사성전자',       sector: '기술', baseVolatility: 0.014, currentPrice: 288_900,   openPrice: 288_900,   high: 288_900,   low: 288_900,   volume: 0 },
  { id: 'CHOC', name: '초콜릿',         sector: '기술', baseVolatility: 0.030, currentPrice: 42_400,    openPrice: 42_400,    high: 42_400,    low: 42_400,    volume: 0 },
  { id: 'SKYH', name: 'SKY 하이',       sector: '기술', baseVolatility: 0.012, currentPrice: 2_369_000, openPrice: 2_369_000, high: 2_369_000, low: 2_369_000, volume: 0 },
  // 교육
  { id: 'MINC', name: 'aishift',         sector: '교육', baseVolatility: 0.030, currentPrice: 18_900,    openPrice: 18_900,    high: 18_900,    low: 18_900,    volume: 0 },
  { id: 'DKCD', name: '득코딩',         sector: '교육', baseVolatility: 0.025, currentPrice: 10_300,    openPrice: 10_300,    high: 10_300,    low: 10_300,    volume: 0 },
  { id: 'CRZU', name: '크레이지 유니버스', sector: '교육', baseVolatility: 0.035, currentPrice: 8_900,   openPrice: 8_900,    high: 8_900,     low: 8_900,     volume: 0 },
  // 금융
  { id: 'DRBN', name: '두리은행',       sector: '금융', baseVolatility: 0.015, currentPrice: 115_700,   openPrice: 115_700,   high: 115_700,   low: 115_700,   volume: 0 },
  { id: 'SSSN', name: '사성증권',       sector: '금융', baseVolatility: 0.018, currentPrice: 127_600,   openPrice: 127_600,   high: 127_600,   low: 127_600,   volume: 0 },
  { id: 'NNBK', name: '너네은행',       sector: '금융', baseVolatility: 0.016, currentPrice: 29_600,    openPrice: 29_600,    high: 29_600,    low: 29_600,    volume: 0 },
  // 물류
  { id: 'CPNG', name: '콘팡',           sector: '물류', baseVolatility: 0.025, currentPrice: 19_600,    openPrice: 19_600,    high: 19_600,    low: 19_600,    volume: 0 },
  { id: 'NVRL', name: '네버라인',       sector: '물류', baseVolatility: 0.022, currentPrice: 25_700,    openPrice: 25_700,    high: 25_700,    low: 25_700,    volume: 0 },
  { id: 'CHMK', name: '체리마켓',       sector: '물류', baseVolatility: 0.018, currentPrice: 210_000,   openPrice: 210_000,   high: 210_000,   low: 210_000,   volume: 0 },
  // 게임
  { id: 'NEXT', name: '넥스트',         sector: '게임', baseVolatility: 0.040, currentPrice: 22_000,    openPrice: 22_000,    high: 22_000,    low: 22_000,    volume: 0 },
  { id: 'MKSF', name: 'MK소프트',       sector: '게임', baseVolatility: 0.025, currentPrice: 297_000,   openPrice: 297_000,   high: 297_000,   low: 297_000,   volume: 0 },
  { id: 'OBSD', name: '옵시디안',       sector: '게임', baseVolatility: 0.038, currentPrice: 43_200,    openPrice: 43_200,    high: 43_200,    low: 43_200,    volume: 0 },
]

const roundWon = (n: number) => Math.max(100, Math.round(n / 100) * 100)

/**
 * 게임 시작 시점의 종목 목록.
 * 현재가(currentPrice)는 그대로 두고, 시작가(openPrice)를 현재가의 ±10% 안에서 무작위로 정한다.
 * 시작가 → 현재가 구간을 "시작 전" 가격 이력으로 넣어, 첫 분기에도 차트와 등락률이 표시된다.
 * seed 를 주면(대회 모드) 같은 시드의 모든 참가자가 같은 시작가를 받는다.
 */
export function buildInitialStocks(seed?: string): Stock[] {
  const t = Date.now()
  const rng = seed ? createRng(`${seed}:start`) : randomRng
  return STOCK_SEEDS.map(s => {
    const start = roundWon(s.currentPrice * (1 + rng.range(-1, 1) * 0.1))
    return {
      ...s,
      openPrice: start,
      high: Math.max(start, s.currentPrice),
      low:  Math.min(start, s.currentPrice),
      priceHistory: [
        { timestamp: t - 1, price: start },
        { timestamp: t,     price: s.currentPrice, quarterLabel: '시작 전' },
      ],
    }
  })
}
