import { create } from 'zustand'
import type { Position, Transaction } from '../types'

interface PortfolioState {
  cash: number
  positions: Record<string, Position>
  transactions: Transaction[]
  prevQuarterPositions: Record<string, Position>

  init: (initialCapital: number) => void
  buyStock:  (stockId: string, shares: number, price: number, quarter: string) => string | null
  sellStock: (stockId: string, shares: number, price: number, quarter: string) => string | null
  snapshotPositions: () => void
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  cash: 0,
  positions: {},
  transactions: [],
  prevQuarterPositions: {},

  init: (initialCapital) => set({ cash: initialCapital, positions: {}, transactions: [], prevQuarterPositions: {} }),

  snapshotPositions: () => set(state => ({
    prevQuarterPositions: Object.fromEntries(
      Object.entries(state.positions).map(([id, pos]) => [id, { ...pos }])
    ),
  })),

  buyStock: (stockId, shares, price, quarter) => {
    if (shares <= 0) return '수량을 1 이상 입력해주세요.'
    const cost = shares * price
    if (get().cash < cost) return '잔금이 부족합니다.'

    set(state => {
      const prev = state.positions[stockId]
      const totalShares = (prev?.shares ?? 0) + shares
      const avgCost = ((prev?.shares ?? 0) * (prev?.averageCost ?? 0) + cost) / totalShares
      const tx: Transaction = {
        id: `${stockId}-${Date.now()}`,
        stockId, type: 'buy', shares, pricePerShare: price,
        totalValue: cost, quarter, timestamp: Date.now(),
      }
      return {
        cash: state.cash - cost,
        positions: {
          ...state.positions,
          [stockId]: { stockId, shares: totalShares, averageCost: avgCost },
        },
        transactions: [tx, ...state.transactions],
      }
    })
    return null
  },

  sellStock: (stockId, shares, price, quarter) => {
    if (shares <= 0) return '수량을 1 이상 입력해주세요.'
    const pos = get().positions[stockId]
    if (!pos || pos.shares < shares) return '보유 수량이 부족합니다.'

    set(state => {
      const proceeds = shares * price
      const remaining = (state.positions[stockId]?.shares ?? 0) - shares
      const updated = { ...state.positions }
      if (remaining === 0) delete updated[stockId]
      else updated[stockId] = { ...updated[stockId], shares: remaining }
      const tx: Transaction = {
        id: `${stockId}-${Date.now()}`,
        stockId, type: 'sell', shares, pricePerShare: price,
        totalValue: proceeds, quarter, timestamp: Date.now(),
      }
      return { cash: state.cash + proceeds, positions: updated, transactions: [tx, ...state.transactions] }
    })
    return null
  },
}))
