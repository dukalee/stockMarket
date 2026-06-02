import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { TrendingUp, Loader2, Lock, AlertTriangle, ShieldAlert } from 'lucide-react'
import { useGameStore } from '../../stores/gameStore'
import { useMarketStore } from '../../stores/marketStore'
import { usePortfolioStore } from '../../stores/portfolioStore'

interface NavBarProps {
  isAdvancing?: boolean
  onAdvance?: () => void
  advanceError?: string | null
}

const REQUIRED_SECTORS = 2
const REQUIRED_STOCKS  = 2

export default function NavBar({ isAdvancing = false, onAdvance, advanceError }: NavBarProps) {
  const navigate       = useNavigate()
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const phase          = useGameStore(s => s.phase)
  const adminAuth      = useGameStore(s => s.adminAuth)
  const progress       = useMarketStore(s => s.newsLoadingProgress)
  const stocks         = useMarketStore(s => s.stocks)
  const transactions           = usePortfolioStore(s => s.transactions)
  const positions              = usePortfolioStore(s => s.positions)
  const prevQuarterPositions   = usePortfolioStore(s => s.prevQuarterPositions)

  const [confirm,     setConfirm]     = useState(false)
  const [reqModal,    setReqModal]    = useState(false)

  // 이번 분기 매수 조건 계산
  // 매수 후 전량 매도한 종목은 보유 포지션이 없으므로 요건 카운트에서 제외
  const qLabel = `Y${currentYear}Q${currentQuarter}`
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
  const sectorCount = coveredSectors.length
  const stockCount  = boughtStockIds.length

  // 조건 3: 이번 분기 종료 시점 보유 종목이 이전 분기와 달라야 함
  const currHeld = Object.keys(positions).filter(id => (positions[id]?.shares ?? 0) > 0)
  const prevHeld = Object.keys(prevQuarterPositions).filter(id => (prevQuarterPositions[id]?.shares ?? 0) > 0)
  const inventoryChanged = currHeld.length !== prevHeld.length
    || currHeld.some(id => prevQuarterPositions[id]?.shares !== positions[id]?.shares)

  const requirementMet = phase !== 'playing' || (
    stockCount >= REQUIRED_STOCKS &&
    sectorCount >= REQUIRED_SECTORS &&
    inventoryChanged
  )

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-200 text-gray-900'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`

  const handleConfirm = () => {
    setConfirm(false)
    onAdvance?.()
  }

  const handleAdvanceClick = () => {
    if (!requirementMet) { setReqModal(true); return }
    setConfirm(true)
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 shrink-0">
        {isAdvancing && (
          <div className="flex gap-0.5 px-6 py-1 bg-white">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-sm transition-colors duration-300 ${
                  i < progress ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
        {advanceError && (
          <div className="flex items-center gap-2 px-6 py-1.5 bg-red-50 border-b border-red-300 text-red-600 text-xs">
            <AlertTriangle size={12} />
            {advanceError}
          </div>
        )}
        <div className="h-14 flex items-center px-6 gap-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-emerald-400 font-bold text-lg tracking-tight hover:text-emerald-300 transition-colors"
          >
            <TrendingUp size={20} />
            MincoStocks
          </button>

          <nav className="flex items-center gap-1">
            <NavLink to="/"     end className={tabClass}>홈</NavLink>
            <NavLink to="/trade"    className={tabClass}>거래</NavLink>
            <NavLink to="/news"     className={tabClass}>뉴스</NavLink>
            <button
              onClick={() => navigate(adminAuth ? '/admin/dashboard' : '/admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Lock size={13} />
              Admin
            </button>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">YEAR {currentYear} · Q{currentQuarter}</span>
            <div className="flex items-center">
              {[1, 2, 3, 4].map((q, i) => {
                const completed = q < currentQuarter
                const current   = q === currentQuarter
                return (
                  <div key={q} className="flex items-center">
                    {i > 0 && (
                      <div className={`w-4 h-px ${completed ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    )}
                    <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      completed ? 'bg-emerald-500'
                      : current  ? 'bg-gray-900 ring-2 ring-emerald-400 ring-offset-1 ring-offset-white'
                      : 'bg-transparent border border-gray-400'
                    }`} />
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleAdvanceClick}
            disabled={isAdvancing}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-white text-sm font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 ${
              requirementMet
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-yellow-700 hover:bg-yellow-600'
            }`}
          >
            {isAdvancing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                loading...
              </>
            ) : (
              'Continue →'
            )}
          </button>
        </div>
      </header>

      {/* 매수 조건 미충족 모달 */}
      {reqModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setReqModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-7 flex flex-col gap-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldAlert size={32} className="text-yellow-600" />
              <h2 className="text-gray-900 font-bold text-base">{requirementMet ? '분기 매수 조건 달성' : '분기 매수 조건 미충족'}</h2>
            </div>

            <div className="bg-gray-100 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">서로 다른 종목 매수</span>
                <span className={`font-bold ${stockCount >= REQUIRED_STOCKS ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {stockCount} / {REQUIRED_STOCKS}
                </span>
              </div>

              <div className="border-t border-gray-300 pt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">서로 다른 섹터 매수</span>
                <span className={`font-bold ${sectorCount >= REQUIRED_SECTORS ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {sectorCount} / {REQUIRED_SECTORS}
                </span>
              </div>

              <div className="border-t border-gray-300 pt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">이전 분기 대비 포트폴리오 변경</span>
                <span className={`font-bold ${inventoryChanged ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {inventoryChanged ? '충족' : '미충족'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setReqModal(false)}
              className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-7 flex flex-col gap-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle size={32} className="text-yellow-600" />
              <h2 className="text-gray-900 font-bold text-base">분기 진행 확인</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                YEAR {currentYear} Q{currentQuarter}를 마감하고<br />
                다음 분기로 진행하시겠습니까?<br />
                <span className="text-gray-400 text-xs mt-1 block">진행 후에는 되돌릴 수 없습니다.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                진행하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
