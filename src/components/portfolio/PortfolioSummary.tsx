import { useGameStore } from '../../stores/gameStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

export default function PortfolioSummary() {
  const initialCapital = useGameStore(s => s.initialCapital)
  const cash           = usePortfolioStore(s => s.cash)
  const positions      = usePortfolioStore(s => s.positions)
  const stocks         = useMarketStore(s => s.stocks)

  const stockMap    = Object.fromEntries(stocks.map(s => [s.id, s]))
  const marketValue = Object.values(positions).reduce((sum, pos) => {
    const price = stockMap[pos.stockId]?.currentPrice ?? pos.averageCost
    return sum + pos.shares * price
  }, 0)

  const totalAsset = cash + marketValue
  const pnl        = totalAsset - initialCapital
  const pnlPct     = initialCapital > 0 ? (pnl / initialCapital) * 100 : 0
  const isPos      = pnl >= 0

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card
        label="총 자산"
        value={fmt(totalAsset)}
        sub={fmtPct(pnlPct)}
        subColor={isPos ? 'red' : 'blue'}
      />
      <Card label="보유 현금" value={fmt(cash)} />
      <Card label="투자금"    value={fmt(marketValue)} />
      <Card
        label="전체 수익률"
        value={fmtPct(pnlPct)}
        sub={fmt(pnl)}
        valueColor={isPos ? 'red' : 'blue'}
        subColor={isPos ? 'red' : 'blue'}
      />
    </div>
  )
}

function Card({ label, value, sub, valueColor, subColor }: {
  label: string
  value: string
  sub?: string
  valueColor?: 'red' | 'blue'
  subColor?: 'red' | 'blue'
}) {
  const vc = valueColor === 'red'  ? 'text-red-600'
           : valueColor === 'blue' ? 'text-blue-600'
           : 'text-gray-900'
  const sc = subColor === 'red'  ? 'text-red-600'
           : subColor === 'blue' ? 'text-blue-600'
           : 'text-gray-500'
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col gap-2">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-xl font-bold ${vc}`}>{value}</span>
      {sub && <span className={`text-sm ${sc}`}>{sub}</span>}
    </div>
  )
}
