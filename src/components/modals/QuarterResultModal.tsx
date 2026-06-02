import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useGameStore } from '../../stores/gameStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

function ChangeChip({ change }: { change: number }) {
  if (change > 0) return (
    <span className="flex items-center gap-1 text-red-600 font-bold text-sm">
      <TrendingUp size={14} />
      {fmtPct(change)}
    </span>
  )
  if (change < 0) return (
    <span className="flex items-center gap-1 text-blue-600 font-bold text-sm">
      <TrendingDown size={14} />
      {fmtPct(change)}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-gray-400 font-bold text-sm">
      <Minus size={14} />
      0.0%
    </span>
  )
}

export default function QuarterResultModal() {
  const quarterResult    = useGameStore(s => s.quarterResult)
  const clearQuarterResult = useGameStore(s => s.clearQuarterResult)
  const transactions     = usePortfolioStore(s => s.transactions)
  const positions        = usePortfolioStore(s => s.positions)
  const stocks           = useMarketStore(s => s.stocks)

  if (!quarterResult) return null

  const { endingYear, endingQuarter, newYear, newQuarter, changes } = quarterResult
  const endingQLabel = `Y${endingYear}Q${endingQuarter}`
  const stockMap     = Object.fromEntries(stocks.map(s => [s.id, s]))

  // 전 분기 매도 종목 (sold in ending quarter)
  const soldIds = [...new Set(
    transactions
      .filter(t => t.type === 'sell' && t.quarter === endingQLabel)
      .map(t => t.stockId)
  )]

  // 전 분기 매수 종목 (bought in ending quarter, still held)
  const boughtHeldIds = [...new Set(
    transactions
      .filter(t => t.type === 'buy' && t.quarter === endingQLabel)
      .map(t => t.stockId)
      .filter(id => (positions[id]?.shares ?? 0) > 0)
  )]

  const hasSold   = soldIds.length > 0
  const hasBought = boughtHeldIds.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">

        {/* 헤더 */}
        <div className="px-6 py-5 bg-emerald-600 text-white">
          <p className="text-xs opacity-75 mb-1">분기 전환 완료</p>
          <h2 className="text-2xl font-bold">YEAR {newYear} · Q{newQuarter} 시작</h2>
          <p className="text-xs opacity-60 mt-1">
            Y{endingYear}Q{endingQuarter} 결과 반영 완료
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* 전 분기 매도 종목 */}
          {hasSold && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                전 분기 매도 종목 — 매도 후 가격 변동
              </p>
              <div className="flex flex-col gap-1.5">
                {soldIds.map(id => {
                  const change = changes[id] ?? 0
                  const stock  = stockMap[id]
                  return (
                    <div key={id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold text-sm">{id}</span>
                        <span className="text-gray-600 text-xs">{stock?.name ?? id}</span>
                        <span className="text-gray-400 text-xs">{stock?.sector}</span>
                      </div>
                      <ChangeChip change={change} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 전 분기 매수 보유 종목 */}
          {hasBought && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                전 분기 매수 종목 — 보유 중
              </p>
              <div className="flex flex-col gap-1.5">
                {boughtHeldIds.map(id => {
                  const change = changes[id] ?? 0
                  const stock  = stockMap[id]
                  return (
                    <div key={id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold text-sm">{id}</span>
                        <span className="text-gray-600 text-xs">{stock?.name ?? id}</span>
                        <span className="text-gray-400 text-xs">{stock?.sector}</span>
                      </div>
                      <ChangeChip change={change} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!hasSold && !hasBought && (
            <p className="text-gray-400 text-sm text-center py-4">
              전 분기 거래 내역이 없습니다.
            </p>
          )}

        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5">
          <button
            onClick={clearQuarterResult}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
          >
            YEAR {newYear} · Q{newQuarter} 거래 시작 →
          </button>
        </div>

      </div>
    </div>
  )
}
