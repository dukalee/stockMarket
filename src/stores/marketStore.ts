import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Stock, NewsArticle } from '../types'
import { buildInitialStocks } from '../data/stocks'
import { MAX_HISTORY_POINTS } from '../utils/constants'

interface MarketState {
  stocks: Stock[]
  currentNews: NewsArticle[]
  newsLoading: boolean
  newsLoadingProgress: number
  selectedStockId: string | null
  lastFlipped: boolean
  lastFlippedArticle: NewsArticle | null  // 반전된 기사 전체 객체 (분기 진행 후에도 조회 가능)

  tickAllPrices: (nextPrices: Record<string, number>) => void
  applyQuarterPriceChanges: (impacts: Record<string, number>, quarterLabel?: string) => void
  setNews: (news: NewsArticle[]) => void
  setNewsLoading: (v: boolean) => void
  setNewsLoadingProgress: (n: number) => void
  setDiceResult: (flipped: boolean, article: NewsArticle | null) => void
  selectStock: (id: string) => void
  resetMarket: (seed?: string) => void
}

export const useMarketStore = create<MarketState>()(persist((set) => ({
  stocks: buildInitialStocks(),
  currentNews: [],
  newsLoading: false,
  newsLoadingProgress: 0,
  selectedStockId: null,
  lastFlipped: false,
  lastFlippedArticle: null,

  tickAllPrices: (nextPrices) =>
    set(state => ({
      stocks: state.stocks.map(stock => {
        const newPrice = nextPrices[stock.id] ?? stock.currentPrice
        const point = { timestamp: Date.now(), price: newPrice }
        return {
          ...stock,
          currentPrice: newPrice,
          high: Math.max(stock.high, newPrice),
          low: Math.min(stock.low, newPrice),
          volume: stock.volume + Math.floor(Math.random() * 300 + 50),
          priceHistory: [...stock.priceHistory, point].slice(-MAX_HISTORY_POINTS),
        }
      }),
    })),

  applyQuarterPriceChanges: (impacts, quarterLabel) =>
    set(state => ({
      stocks: state.stocks.map(stock => {
        const factor = 1 + (impacts[stock.id] ?? 0) / 100
        const newPrice = Math.max(100, Math.round(stock.currentPrice * factor / 100) * 100)
        const point = quarterLabel
          ? { timestamp: Date.now(), price: newPrice, quarterLabel }
          : { timestamp: Date.now(), price: newPrice }
        return {
          ...stock,
          currentPrice: newPrice,
          openPrice: stock.currentPrice,  // 이전 분기 가격 보존 → 등락 비교 기준
          high: newPrice,
          low: newPrice,
          volume: 0,
          priceHistory: [...stock.priceHistory, point],
        }
      }),
    })),

  setNews:                (news) => set({ currentNews: news }),
  setDiceResult:          (flipped, article) => set({ lastFlipped: flipped, lastFlippedArticle: article }),
  setNewsLoading:         (v)    => set({ newsLoading: v }),
  setNewsLoadingProgress: (n)    => set({ newsLoadingProgress: n }),
  selectStock:            (id)   => set({ selectedStockId: id }),
  resetMarket:            (seed) => set({ stocks: buildInitialStocks(seed), currentNews: [], selectedStockId: null, lastFlipped: false, lastFlippedArticle: null }),
}), {
  name: 'shiftstocks-market',
  version: 1,
  partialize: (s) => ({
    stocks: s.stocks,
    currentNews: s.currentNews,
    selectedStockId: s.selectedStockId,
    lastFlipped: s.lastFlipped,
    lastFlippedArticle: s.lastFlippedArticle,
  }),
}))
