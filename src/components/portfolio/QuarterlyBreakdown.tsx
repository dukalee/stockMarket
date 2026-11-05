import { useState } from 'react'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'
import type { Transaction } from '../../types'

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

interface QuarterSummary {
  quarter: string
  transactions: Transaction[]
  totalBought: number
  totalSold: number
  netCashFlow: number
}

function groupByQuarter(transactions: Transaction[]): QuarterSummary[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const list = map.get(tx.quarter) ?? []
    list.push(tx)
    map.set(tx.quarter, list)
  }

  return Array.from(map.entries()).map(([quarter, txs]) => {
    const totalBought  = txs.filter(t => t.type === 'buy').reduce((s, t) => s + t.totalValue, 0)
    const totalSold    = txs.filter(t => t.type === 'sell').reduce((s, t) => s + t.totalValue, 0)
    return { quarter, transactions: txs, totalBought, totalSold, netCashFlow: totalSold - totalBought }
  })
}

export default function QuarterlyBreakdown() {
  const transactions = usePortfolioStore(s => s.transactions)
  const positions    = usePortfolioStore(s => s.positions)
  const stocks       = useMarketStore(s => s.stocks)

  const stockMap  = Object.fromEntries(stocks.map(s => [s.id, s]))
  const quarters  = groupByQuarter(transactions)

  // 현재 미실현 손익
  const unrealizedPnL = Object.values(positions).reduce((sum, pos) => {
    const cur = stockMap[pos.stockId]?.currentPrice ?? pos.averageCost
    return sum + pos.shares * (cur - pos.averageCost)
  }, 0)

  const totalCost = Object.values(positions).reduce((sum, pos) => sum + pos.shares * pos.averageCost, 0)
  const unrealizedPct = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-10 text-center">
        <p className="text-ink-soft text-sm">아직 거래 내역이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">

      {/* 미실현 손익 요약 */}
      {Object.keys(positions).length > 0 && (
        <div className="border-y-2 border-ink px-1 py-3 flex justify-between items-center text-sm">
          <span className="text-mute">현재 미실현 손익</span>
          <span className={`font-bold ${unrealizedPnL >= 0 ? 'text-up' : 'text-down'}`}>
            {fmt(unrealizedPnL)}
            <span className="text-xs ml-1.5 opacity-80">({fmtPct(unrealizedPct * 100)})</span>
          </span>
        </div>
      )}

      {/* 분기별 아코디언 */}
      {quarters.map(q => (
        <QuarterAccordion key={q.quarter} summary={q} stockMap={stockMap} />
      ))}
    </div>
  )
}

function QuarterAccordion({
  summary, stockMap,
}: {
  summary: QuarterSummary
  stockMap: Record<string, { name: string; currentPrice: number }>
}) {
  const [open, setOpen] = useState(true)
  const { quarter, transactions, totalBought, totalSold, netCashFlow } = summary
  const isProfit = netCashFlow >= 0

  return (
    <div className="border border-ink">
      {/* 분기 헤더 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 min-h-10 py-2 bg-paper-deep hover:brightness-95 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-ink text-xs">{open ? '▼' : '▶'}</span>
          <span className="text-ink font-serif font-black text-sm">{quarter}</span>
          <span className="text-mute text-xs">{transactions.length}건</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 text-xs">
          <span className="text-mute">
            매수 <span className="text-up">{fmt(totalBought)}</span>
          </span>
          <span className="text-mute">
            매도 <span className="text-down">{fmt(totalSold)}</span>
          </span>
          <span className={`font-bold ${isProfit ? 'text-up' : 'text-down'}`}>
            순 {netCashFlow >= 0 ? '+' : ''}{fmt(netCashFlow)}
          </span>
        </div>
      </button>

      {/* 거래 목록 */}
      {open && (
        <div>
          {transactions.map(tx => {
            const isBuy = tx.type === 'buy'
            const name  = stockMap[tx.stockId]?.name ?? tx.stockId
            return (
              <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 text-xs border-t border-rule">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 font-bold text-white shrink-0 ${
                    isBuy ? 'bg-up' : 'bg-down'
                  }`}>
                    {isBuy ? '매수' : '매도'}
                  </span>
                  <span className="text-ink font-bold">{tx.stockId}</span>
                  <span className="text-mute truncate">{name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-ink-soft">
                  <span>{tx.shares.toLocaleString('ko-KR')}주 × {fmt(tx.pricePerShare)}</span>
                  <span className={`font-bold w-28 text-right tabular-nums ${isBuy ? 'text-up' : 'text-down'}`}>
                    {isBuy ? '-' : '+'}{fmt(tx.totalValue)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
