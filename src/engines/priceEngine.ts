import type { Stock } from '../types'
import { INTRA_QUARTER_VOL_FACTOR } from '../utils/constants'

function randomNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function tickPrice(stock: Stock): number {
  const sigma = stock.baseVolatility * INTRA_QUARTER_VOL_FACTOR
  const drift = -0.00005
  const next  = stock.currentPrice * Math.exp(drift + sigma * randomNormal())
  return Math.max(100, Math.round(next / 100) * 100)
}

export function computeNextPrices(stocks: Stock[]): Record<string, number> {
  return Object.fromEntries(stocks.map(s => [s.id, tickPrice(s)]))
}
