import { ReactNode, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import PortfolioSummary from '../components/portfolio/PortfolioSummary'
import HoldingsTable from '../components/portfolio/HoldingsTable'
import TransactionHistory from '../components/portfolio/TransactionHistory'
import QuarterlyBreakdown from '../components/portfolio/QuarterlyBreakdown'
import { useGameStore } from '../stores/gameStore'
import { useMarketStore } from '../stores/marketStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'

const REQUIRED_STOCKS  = 2
const REQUIRED_SECTORS = 2

type RightTab = 'history' | 'quarterly'

export default function HomePage() {
  const userName       = useGameStore(s => s.userName)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const stocks         = useMarketStore(s => s.stocks)
  const transactions   = usePortfolioStore(s => s.transactions)
  const positions      = usePortfolioStore(s => s.positions)
  const prevQuarterPositions = usePortfolioStore(s => s.prevQuarterPositions)
  const [rightTab, setRightTab] = useState<RightTab>('history')
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  const qLabel   = `Y${currentYear}Q${currentQuarter}`
  const stockMap = Object.fromEntries(stocks.map(s => [s.id, s]))

  const boughtStockIds = [...new Set(
    transactions
      .filter(t => t.type === 'buy' && t.quarter === qLabel)
      .map(t => t.stockId)
      .filter(id => (positions[id]?.shares ?? 0) > 0)
  )]
  const coveredSectors = [...new Set(
    boughtStockIds.map(id => stockMap[id]?.sector).filter(Boolean)
  )]
  const stockCount  = boughtStockIds.length
  const sectorCount = coveredSectors.length

  const currHeld = Object.keys(positions).filter(id => (positions[id]?.shares ?? 0) > 0)
  const prevHeld = Object.keys(prevQuarterPositions).filter(id => (prevQuarterPositions[id]?.shares ?? 0) > 0)
  const inventoryChanged = currHeld.length !== prevHeld.length
    || currHeld.some(id => prevQuarterPositions[id]?.shares !== positions[id]?.shares)

  const reqs = [
    { label: `서로 다른 종목 ${REQUIRED_STOCKS}개 이상 매수`, status: `${stockCount}/${REQUIRED_STOCKS}`, met: stockCount >= REQUIRED_STOCKS },
    { label: `서로 다른 섹터 ${REQUIRED_SECTORS}개 이상 매수`, status: `${sectorCount}/${REQUIRED_SECTORS}`, met: sectorCount >= REQUIRED_SECTORS },
    { label: '이전 분기 대비 포트폴리오 변경', status: inventoryChanged ? '충족' : '미충족', met: inventoryChanged },
  ]
  const allMet = reqs.every(r => r.met)

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-lg text-gray-700">
            안녕하세요, <span className="text-gray-900 font-semibold">{userName}</span>님
          </h1>
          <p className="text-gray-400 text-sm">YEAR {currentYear} Q{currentQuarter} 진행 중</p>
        </div>

        {/* 게임 규칙 + 분기 진행 조건 */}
        <div className={`rounded-xl border px-5 py-4 flex flex-col gap-3 ${
          allMet ? 'border-emerald-300 bg-emerald-50' : 'border-yellow-200 bg-yellow-50'
        }`}>
          <p className="text-sm font-bold text-gray-700">주식거래 시뮬레이터</p>
          <ol className="flex flex-col gap-2 text-xs text-gray-500 list-none">
            <li>1. 1년은 4분기로 나뉘어서 진행됩니다. 즉, 1년에 4번의 주식 거래를 합니다.</li>
            <li>2. 각 분기에 제공된 주요 뉴스 기사들을 읽고, 가장 많은 수익을 낼 수 있는 방법으로 투자를 해주세요.</li>
            <li>
              3. 각 분기에는 아래 조건을 충족해야 다음 분기로 넘어갈 수 있습니다.
              <ul className="flex flex-col gap-1.5 mt-2 ml-3">
                <li className="flex items-center gap-2">
                  <span className={`font-bold shrink-0 ${reqs[0].met ? 'text-emerald-600' : 'text-yellow-600'}`}>{reqs[0].met ? '✓' : '✗'}</span>
                  <span>i. 최소 2개 이상의 종목에 투자 (매수)를 해야 합니다.</span>
                  <span className={`ml-auto font-semibold shrink-0 ${reqs[0].met ? 'text-emerald-600' : 'text-yellow-600'}`}>{reqs[0].status}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className={`font-bold shrink-0 ${reqs[1].met ? 'text-emerald-600' : 'text-yellow-600'}`}>{reqs[1].met ? '✓' : '✗'}</span>
                  <span>ii. 최소 2개 이상의 분야에 투자를 해야 합니다.</span>
                  <span className={`ml-auto font-semibold shrink-0 ${reqs[1].met ? 'text-emerald-600' : 'text-yellow-600'}`}>{reqs[1].status}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className={`font-bold shrink-0 ${reqs[2].met ? 'text-emerald-600' : 'text-yellow-600'}`}>{reqs[2].met ? '✓' : '✗'}</span>
                  <span>iii. 전 분기와 동일한 포트폴리오로 다음 분기로 진행할 수 없습니다.</span>
                  <span className={`ml-auto font-semibold shrink-0 ${reqs[2].met ? 'text-emerald-600' : 'text-yellow-600'}`}>{reqs[2].status}</span>
                </li>
              </ul>
            </li>
          </ol>
        </div>

        <PortfolioSummary />

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {/* 좌: 보유 종목 */}
          <Panel title="보유 종목">
            <HoldingsTable />
          </Panel>

          {/* 우: 탭 패널 */}
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
            {/* 탭 헤더 */}
            <div className="flex border-b border-gray-200 shrink-0">
              <TabBtn active={rightTab === 'history'} onClick={() => setRightTab('history')}>
                거래 내역
              </TabBtn>
              <TabBtn active={rightTab === 'quarterly'} onClick={() => setRightTab('quarterly')}>
                분기별 현황
              </TabBtn>
            </div>

            {/* 탭 본문 */}
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto min-h-0">
      <h2 className="text-gray-600 font-semibold text-sm shrink-0">{title}</h2>
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
      className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
        active
          ? 'text-gray-900 border-emerald-600'
          : 'text-gray-400 border-transparent hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}
