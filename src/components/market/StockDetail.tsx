import { TrendingUp, TrendingDown } from 'lucide-react'
import { useMarketStore } from '../../stores/marketStore'
import { useGameStore } from '../../stores/gameStore'
import PriceChart from './PriceChart'
import TradePanel from '../trading/TradePanel'

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const pctChg = (cur: number, open: number) => ((cur - open) / open) * 100
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

export default function StockDetail() {
  const stocks     = useMarketStore(s => s.stocks)
  const selectedId = useMarketStore(s => s.selectedStockId)
  const phase      = useGameStore(s => s.phase)

  const stock      = stocks.find(s => s.id === selectedId) ?? null
  const isAdvancing = phase === 'advancing'

  if (!stock) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        좌측에서 종목을 선택하세요
      </div>
    )
  }

  const pct  = pctChg(stock.currentPrice, stock.openPrice)
  const isUp = pct >= 0

  return (
    <div className="flex-1 flex flex-col h-full p-6 gap-4 overflow-hidden">
      {/* 종목 헤더 */}
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-900">{stock.name}</span>
          <span className="text-gray-400 text-sm">{stock.id}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{stock.sector}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold text-gray-900">{fmt(stock.currentPrice)}</span>
          <span className={`flex items-center gap-1 text-lg font-semibold ${pct > 0 ? 'text-red-600' : pct < 0 ? 'text-blue-600' : 'text-gray-900'}`}>
            {isUp ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {fmtPct(pct)}
          </span>
        </div>
      </div>

      {/* OHL */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          { label: '분기 시작가', value: fmt(stock.openPrice) },
          { label: '고가',        value: fmt(stock.high) },
          { label: '저가',        value: fmt(stock.low) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">{label}</p>
            <p className="text-gray-900 text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

      {/* 가격 차트 — relative wrapper 로 ResponsiveContainer 높이 보장 */}
      <div className="flex-1 min-h-0 relative bg-gray-50 border border-gray-200 rounded-xl" style={{ minHeight: 200 }}>
        <div className="absolute inset-0">
          <PriceChart
            history={stock.priceHistory}
            openPrice={stock.priceHistory[0]?.price ?? stock.openPrice}
          />
        </div>
      </div>

      {/* 매수 / 매도 패널 */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <TradePanel type="buy"  stockId={stock.id} price={stock.currentPrice} disabled={isAdvancing} />
        <TradePanel type="sell" stockId={stock.id} price={stock.currentPrice} disabled={isAdvancing} />
      </div>
    </div>
  )
}
