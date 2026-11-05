import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

export default function TransactionHistory() {
  const transactions = usePortfolioStore(s => s.transactions)
  const stocks       = useMarketStore(s => s.stocks)
  const stockMap     = Object.fromEntries(stocks.map(s => [s.id, s]))

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
        <p className="text-ink-soft text-sm">거래 내역이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {transactions.map(tx => {
        const isBuy     = tx.type === 'buy'
        const stockName = stockMap[tx.stockId]?.name ?? tx.stockId

        return (
          <div key={tx.id} className="flex items-center justify-between py-3 border-b border-rule first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-mute text-xs shrink-0">{tx.quarter}</span>
                <span className="text-ink font-bold text-sm">{tx.stockId}</span>
                <span className={`text-xs px-1.5 py-0.5 font-bold text-white shrink-0 ${
                  isBuy ? 'bg-up' : 'bg-down'
                }`}>
                  {isBuy ? '매수' : '매도'}
                </span>
              </div>
              <span className="text-mute text-xs truncate">
                {stockName} · {tx.shares.toLocaleString('ko-KR')}주 · 단가 {fmt(tx.pricePerShare)}
              </span>
            </div>
            <span className="text-ink text-sm font-bold tabular-nums shrink-0 ml-4">{fmt(tx.totalValue)}</span>
          </div>
        )
      })}
    </div>
  )
}
