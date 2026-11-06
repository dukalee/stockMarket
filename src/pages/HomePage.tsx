import { ReactNode, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import PortfolioSummary from '../components/portfolio/PortfolioSummary'
import HoldingsTable from '../components/portfolio/HoldingsTable'
import TransactionHistory from '../components/portfolio/TransactionHistory'
import QuarterlyBreakdown from '../components/portfolio/QuarterlyBreakdown'
import { useGameStore } from '../stores/gameStore'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'


type RightTab = 'history' | 'quarterly'

export default function HomePage() {
  const userName       = useGameStore(s => s.userName)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const mode           = useGameStore(s => s.mode)
  const contest        = useGameStore(s => s.contest)
  const totalQuarters  = useGameStore(s => s.totalQuarters)
  const [rightTab, setRightTab] = useState<RightTab>('history')
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="h-full overflow-y-auto bg-paper p-4 sm:p-6 flex flex-col gap-6">
        <div className="border-b-4 border-double border-ink pb-3">
          <h1 className="font-serif font-black text-2xl text-ink">
            안녕하세요, <span>{userName}</span>님
          </h1>
          <p className="text-mute text-sm mt-1">YEAR {currentYear} Q{currentQuarter} 진행 중</p>
        </div>

        {/* 게임 규칙 */}
        <div className="border border-ink bg-paper-card px-5 py-4 flex flex-col gap-3">
          <p className="font-serif font-black text-lg text-ink border-b-2 border-ink pb-1">
            {mode === 'contest' && contest ? `대회 규칙, ${contest.title || contest.code}` : '주식거래 시뮬레이터'}
          </p>
          <ol className="flex flex-col gap-2 text-sm text-ink-soft list-none">
            <li>
              1. 총 {totalQuarters}분기로 진행됩니다. 즉, {totalQuarters}번의 주식 거래를 합니다.
              {mode === 'contest' && contest && (
                <>
                  {' '}분기마다 제한시간은 {Math.round(contest.roundSeconds / 60 * 10) / 10}분이고, 안에 마치지 못하면 보유 현금과 주식의 {Math.round(contest.penaltyRate * 100)}%를 잃습니다.
                </>
              )}
            </li>
            <li>2. 각 분기에 제공된 주요 뉴스 기사들을 읽고, 가장 많은 수익을 낼 수 있는 방법으로 투자를 해주세요.</li>
            <li>3. 이번 분기에 매수한 수량은 같은 분기에 되팔 수 없습니다. 다음 분기부터 매도할 수 있습니다.</li>
          </ol>
        </div>

        <PortfolioSummary />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 flex-1 min-h-0">
          {/* 좌: 보유 종목 */}
          <Panel title="보유 종목">
            <HoldingsTable />
          </Panel>

          {/* 우: 탭 패널 */}
          <div className="border border-ink bg-paper-card flex flex-col min-h-0 overflow-hidden">
            <div className="flex border-b-2 border-ink shrink-0">
              <TabBtn active={rightTab === 'history'} onClick={() => setRightTab('history')}>
                거래 내역
              </TabBtn>
              <TabBtn active={rightTab === 'quarterly'} onClick={() => setRightTab('quarterly')}>
                분기별 현황
              </TabBtn>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {rightTab === 'history'
                ? <TransactionHistory />
                : <QuarterlyBreakdown />
              }
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-ink bg-paper-card p-5 flex flex-col gap-4 overflow-y-auto min-h-0">
      <h2 className="font-serif font-black text-lg text-ink border-b-2 border-ink pb-1 shrink-0">{title}</h2>
      {children}
    </div>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-h-10 py-2 text-sm transition-colors ${
        active
          ? 'bg-ink text-paper font-bold'
          : 'bg-transparent text-ink-soft font-medium hover:bg-paper-deep'
      }`}
    >
      {children}
    </button>
  )
}
