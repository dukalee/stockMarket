import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  /** 시간 초과 페널티: 현금과 보유 주식을 rate(0~1) 만큼 잃는다. 잃은 내역을 돌려준다. */
  applyPenalty: (rate: number) => { cashLoss: number; stockLosses: { stockId: string; shares: number }[] }
}

/**
 * 지금 매도할 수 있는 수량 = 보유 수량 - 이번 분기에 매수한 수량.
 * 같은 분기에 산 주식은 팔 수 없으므로 매도는 이전 분기부터 가지고 있던 수량에서만 일어난다.
 */
export function getSellableShares(
  positions: Record<string, Position>,
  transactions: Transaction[],
  stockId: string,
  quarter: string,
): number {
  const held = positions[stockId]?.shares ?? 0
  const boughtThisQuarter = transactions
    .filter(t => t.type === 'buy' && t.stockId === stockId && t.quarter === quarter)
    .reduce((sum, t) => sum + t.shares, 0)
  return Math.max(0, held - boughtThisQuarter)
}

export const usePortfolioStore = create<PortfolioState>()(persist((set, get) => ({
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
    // 이번 분기에 매수한 수량은 같은 분기에 매도할 수 없다
    const sellable = getSellableShares(get().positions, get().transactions, stockId, quarter)
    if (shares > sellable) return '이번 분기에 매수한 수량은 다음 분기부터 매도할 수 있습니다.'

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

  applyPenalty: (rate) => {
    const { cash, positions } = get()
    const cashLoss = Math.round(cash * rate)
    const stockLosses: { stockId: string; shares: number }[] = []
    const next = { ...positions }
    for (const [id, pos] of Object.entries(positions)) {
      // 주식은 정수 주 단위라 25%에 가장 가까운 정수만큼 잃는다 (1주만 가지고 있으면 잃지 않음)
      const lose = Math.min(pos.shares, Math.round(pos.shares * rate))
      if (lose <= 0) continue
      stockLosses.push({ stockId: id, shares: lose })
      const remain = pos.shares - lose
      if (remain <= 0) delete next[id]
      else next[id] = { ...pos, shares: remain }
    }
    set({ cash: cash - cashLoss, positions: next })
    return { cashLoss, stockLosses }
  },
}), {
  name: 'shiftstocks-portfolio',
  version: 1,
  partialize: (s) => ({
    cash: s.cash,
    positions: s.positions,
    transactions: s.transactions,
    prevQuarterPositions: s.prevQuarterPositions,
  }),
}))
