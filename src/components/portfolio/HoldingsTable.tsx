import { TrendingUp, TrendingDown, PackageOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

export default function HoldingsTable() {
  const navigate   = useNavigate()
  const positions  = usePortfolioStore(s => s.positions)
  const stocks     = useMarketStore(s => s.stocks)
  const selectStock = useMarketStore(s => s.selectStock)
  const stockMap   = Object.fromEntries(stocks.map(s => [s.id, s]))
  const rows       = Object.values(positions)

  function goTrade(stockId: string) {
    selectStock(stockId)
    navigate('/trade')
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
        <PackageOpen size={32} className="text-gray-300" />
        <p className="text-gray-500 text-sm">아직 보유 중인 종목이 없습니다.</p>
        <p className="text-gray-400 text-xs">거래 화면에서 첫 투자를 시작해보세요.</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-400 text-xs border-b border-gray-200">
          <th className="text-left pb-2 font-medium">심볼</th>
          <th className="text-left pb-2 font-medium">기업명</th>
          <th className="text-right pb-2 font-medium">보유</th>
          <th className="text-right pb-2 font-medium">평가손익</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map(pos => {
          const stock    = stockMap[pos.stockId]
          const curPrice = stock?.currentPrice ?? pos.averageCost
          const pnlPct   = ((curPrice - pos.averageCost) / pos.averageCost) * 100
          const isPos    = pnlPct >= 0

          return (
            <tr key={pos.stockId} className="hover:bg-gray-100 transition-colors">
              <td className="py-3 text-emerald-600 font-semibold">{pos.stockId}</td>
              <td className="py-3 text-gray-600">
                <div>{stock?.name ?? pos.stockId}</div>
                <div className="text-gray-400 text-xs">
                  {fmt(pos.averageCost)} → {fmt(curPrice)}
                </div>
              </td>
              <td className="py-3 text-right text-gray-600">{pos.shares}주</td>
              <td className={`py-3 text-right font-semibold ${pnlPct > 0 ? 'text-red-600' : pnlPct < 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                <span className="inline-flex items-center gap-1 justify-end">
                  {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {fmtPct(pnlPct)}
                </span>
              </td>
              <td className="py-3 pl-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goTrade(pos.stockId)}
                    className="px-2 py-1 text-xs rounded bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    매수
                  </button>
                  <button
                    onClick={() => goTrade(pos.stockId)}
                    className="px-2 py-1 text-xs rounded bg-blue-50 border border-blue-300 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    매도
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
