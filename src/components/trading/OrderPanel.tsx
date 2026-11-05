import { useState } from 'react'
import { useMarketStore } from '../../stores/marketStore'
import { useGameStore, quarterIndexOf } from '../../stores/gameStore'
import { usePortfolioStore, getSellableShares } from '../../stores/portfolioStore'
import TradePanel from './TradePanel'

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

/**
 * 거래 화면 오른쪽 열의 주문서.
 * 매수/매도는 탭으로 전환하고, 아래에 선택한 종목의 내 보유 현황을 보여준다.
 */
export default function OrderPanel() {
  const stocks     = useMarketStore(s => s.stocks)
  const selectedId = useMarketStore(s => s.selectedStockId)
  const phase      = useGameStore(s => s.phase)
  const mode       = useGameStore(s => s.mode)
  const roundSubmitted = useGameStore(s => s.roundSubmitted)
  const qIndex     = useGameStore(s => quarterIndexOf(s.currentYear, s.currentQuarter))
  const year       = useGameStore(s => s.currentYear)
  const quarter    = useGameStore(s => s.currentQuarter)
  const positions    = usePortfolioStore(s => s.positions)
  const transactions = usePortfolioStore(s => s.transactions)

  const [tab, setTab] = useState<'buy' | 'sell'>('buy')

  const stock = stocks.find(s => s.id === selectedId) ?? null
  if (!stock) return null

  const pos      = positions[stock.id]
  const held     = pos?.shares ?? 0
  const sellable = getSellableShares(positions, transactions, stock.id, `Y${year}Q${quarter}`)
  const evalPct  = pos ? ((stock.currentPrice - pos.averageCost) / pos.averageCost) * 100 : 0

  const tabCls = (active: boolean, color: string) =>
    `flex-1 h-11 text-base font-bold transition-colors ${
      active ? `${color} text-white` : 'bg-transparent text-ink hover:bg-paper-deep'
    }`

  return (
    <aside className="w-80 shrink-0 border-l border-ink bg-paper overflow-y-auto flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b-2 border-ink">
        <h2 className="font-serif font-black text-xl">주문서</h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* 매수 / 매도 탭 */}
        <div className="flex border border-ink" role="tablist" aria-label="주문 종류">
          <button
            role="tab" aria-selected={tab === 'buy'}
            onClick={() => setTab('buy')}
            className={tabCls(tab === 'buy', 'bg-up')}
          >매수</button>
          <button
            role="tab" aria-selected={tab === 'sell'}
            onClick={() => setTab('sell')}
            className={`${tabCls(tab === 'sell', 'bg-down')} border-l border-ink`}
          >매도</button>
        </div>

        <div className="bg-paper-card border border-ink p-4">
          <TradePanel
            key={`${tab}-${stock.id}`}
            embedded
            type={tab}
            stockId={stock.id}
            price={stock.currentPrice}
            disabled={phase !== 'playing' || (mode === 'contest' && roundSubmitted >= qIndex)}
          />
        </div>

        {/* 내 보유 */}
        <section className="flex flex-col gap-2 text-sm">
          <h3 className="font-serif font-black text-base border-b border-ink pb-1.5 m-0">내 보유</h3>
          {held > 0 && pos ? (
            <dl className="m-0 flex flex-col gap-1.5">
              <div className="flex justify-between"><dt className="text-mute">{stock.name}</dt><dd className="m-0 font-bold">{held.toLocaleString('ko-KR')}주</dd></div>
              <div className="flex justify-between"><dt className="text-mute">평균 매수가</dt><dd className="m-0">{fmt(pos.averageCost)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-mute">평가 손익률</dt>
                <dd className={`m-0 font-bold ${evalPct > 0 ? 'text-up' : evalPct < 0 ? 'text-down' : 'text-ink'}`}>
                  {evalPct > 0 ? '▲' : evalPct < 0 ? '▼' : '–'} {Math.abs(evalPct).toFixed(1)}%
                </dd>
              </div>
              <div className="flex justify-between"><dt className="text-mute">매도 가능</dt><dd className="m-0">{sellable.toLocaleString('ko-KR')}주</dd></div>
            </dl>
          ) : (
            <p className="m-0 text-mute">아직 보유한 {stock.name} 주식이 없습니다.</p>
          )}
        </section>
      </div>
    </aside>
  )
}
