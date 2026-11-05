import { useGameStore } from '../../stores/gameStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

function ChangeChip({ change }: { change: number }) {
  if (change > 0) return (
    <span className="flex items-center gap-1 text-up font-bold text-sm tabular-nums">
      ▲
      {fmtPct(change)}
    </span>
  )
  if (change < 0) return (
    <span className="flex items-center gap-1 text-down font-bold text-sm tabular-nums">
      ▼
      {fmtPct(change)}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-mute font-bold text-sm tabular-nums">
      -
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-md border-4 border-double border-ink bg-paper-card max-h-full overflow-y-auto">

        {/* 헤더 */}
        <div className="px-6 py-5 border-b-2 border-ink text-ink">
          <p className="text-sm text-mute mb-1">분기 전환 완료</p>
          <h2 className="font-serif font-black text-2xl">YEAR {newYear} · Q{newQuarter} 시작</h2>
          <p className="text-sm text-mute mt-1">
            Y{endingYear}Q{endingQuarter} 결과 반영 완료
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">

          {/* 전 분기 매도 종목 */}
          {hasSold && (
            <div>
              <p className="text-sm font-bold text-ink border-b border-ink pb-1 mb-2">
                전 분기 매도 종목 — 매도 후 가격 변동
              </p>
              <div className="flex flex-col">
                {soldIds.map(id => {
                  const change = changes[id] ?? 0
                  const stock  = stockMap[id]
                  return (
                    <div key={id} className="flex items-center justify-between border-b border-rule px-1 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-ink font-bold text-sm">{id}</span>
                        <span className="text-ink-soft text-xs">{stock?.name ?? id}</span>
                        <span className="text-mute text-xs">{stock?.sector}</span>
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
              <p className="text-sm font-bold text-ink border-b border-ink pb-1 mb-2">
                전 분기 매수 종목 — 보유 중
              </p>
              <div className="flex flex-col">
                {boughtHeldIds.map(id => {
                  const change = changes[id] ?? 0
                  const stock  = stockMap[id]
                  return (
                    <div key={id} className="flex items-center justify-between border-b border-rule px-1 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-ink font-bold text-sm">{id}</span>
                        <span className="text-ink-soft text-xs">{stock?.name ?? id}</span>
                        <span className="text-mute text-xs">{stock?.sector}</span>
                      </div>
                      <ChangeChip change={change} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!hasSold && !hasBought && (
            <p className="text-mute text-sm text-center py-4">
              전 분기 거래 내역이 없습니다.
            </p>
          )}

        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5">
          <button
            onClick={clearQuarterResult}
            className="w-full min-h-10 py-3 bg-ink text-paper font-bold text-sm hover:bg-ink-soft transition-colors"
          >
            YEAR {newYear} · Q{newQuarter} 거래 시작 →
          </button>
        </div>

      </div>
    </div>
  )
}
