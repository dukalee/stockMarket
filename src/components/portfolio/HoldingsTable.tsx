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
        <p className="text-ink-soft text-sm">아직 보유 중인 종목이 없습니다.</p>
        <p className="text-mute text-sm">거래 화면에서 첫 투자를 시작해보세요.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm min-w-[600px]">
      <thead>
        <tr className="text-mute text-sm border-b-2 border-ink">
          <th className="text-left pb-2 font-medium w-full">종목</th>
          <th className="text-right pb-2 pl-6 font-medium whitespace-nowrap">보유</th>
          <th className="text-right pb-2 pl-6 font-medium whitespace-nowrap">매수 시 1주당</th>
          <th className="text-right pb-2 pl-6 font-medium whitespace-nowrap">현재 1주당</th>
          <th className="text-right pb-2 pl-6 font-medium whitespace-nowrap">평가손익</th>
          <th className="pb-2" />
        </tr>
      </thead>
      <tbody>
        {rows.map(pos => {
          const stock    = stockMap[pos.stockId]
          const curPrice = stock?.currentPrice ?? pos.averageCost
          const pnlPct   = ((curPrice - pos.averageCost) / pos.averageCost) * 100
          const isPos    = pnlPct >= 0
          // 평가손익 금액은 보유 수량 전체 기준 (1주당 차이 x 수량)
          const pnlAmount = (curPrice - pos.averageCost) * pos.shares

          return (
            <tr key={pos.stockId} className="border-b border-rule hover:bg-paper-deep transition-colors">
              <td className="py-3 text-ink-soft">
                <div className="text-ink font-bold">{stock?.name ?? pos.stockId}{stock && <span className="ml-1.5 text-[11px] font-normal text-mute/70">{stock.sector}</span>}</div>
              </td>
              <td className="py-3 pl-6 text-right text-ink-soft tabular-nums whitespace-nowrap">{pos.shares}주</td>
              <td className="py-3 pl-6 text-right text-ink-soft tabular-nums whitespace-nowrap">{fmt(pos.averageCost)}</td>
              <td className="py-3 pl-6 text-right text-ink font-bold tabular-nums whitespace-nowrap">{fmt(curPrice)}</td>
              <td className={`py-3 pl-6 text-right font-bold tabular-nums whitespace-nowrap ${pnlPct > 0 ? 'text-up' : pnlPct < 0 ? 'text-down' : 'text-ink'}`}>
                <span className="inline-flex items-center gap-1 justify-end">
                  {isPos ? '▲' : '▼'}
                  {fmtPct(pnlPct)}
                </span>
                <div className="text-xs font-medium">
                  {pnlAmount >= 0 ? '+' : '-'}{fmt(Math.abs(pnlAmount))}
                </div>
              </td>
              <td className="py-3 pl-6">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => goTrade(pos.stockId)}
                    className="px-3 min-h-10 text-sm font-bold bg-up text-white hover:brightness-110 transition"
                  >
                    매수
                  </button>
                  <button
                    onClick={() => goTrade(pos.stockId)}
                    className="px-3 min-h-10 text-sm font-bold bg-down text-white hover:brightness-110 transition"
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
    </div>
  )
}
