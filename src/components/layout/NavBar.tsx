import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Loader2, Lock, AlertTriangle, ShieldAlert, Clock, House } from 'lucide-react'
import { useGameStore, quarterIndexOf } from '../../stores/gameStore'
import { useRoundCountdown, formatCountdown } from '../../hooks/useRoundTimer'
import { useMarketStore } from '../../stores/marketStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { resetAllGameState } from '../../services/gameReset'

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
  const mode           = useGameStore(s => s.mode)
  const contest        = useGameStore(s => s.contest)
  const totalQuarters  = useGameStore(s => s.totalQuarters)
  const openFinalResult = useGameStore(s => s.openFinalResult)
  const roundSubmitted  = useGameStore(s => s.roundSubmitted)
  const countdown        = useRoundCountdown()
  const stocks         = useMarketStore(s => s.stocks)
  const transactions           = usePortfolioStore(s => s.transactions)
  const positions              = usePortfolioStore(s => s.positions)
  const prevQuarterPositions   = usePortfolioStore(s => s.prevQuarterPositions)

  const qIndex = quarterIndexOf(currentYear, currentQuarter)
  const isLastQuarter = qIndex >= totalQuarters
  const finished = phase === 'finished'
  const isContest = mode === 'contest'
  const waiting = isContest && phase === 'playing' && roundSubmitted >= qIndex   // 마감하고 다른 참가자를 기다리는 중

  const [quitModal,   setQuitModal]   = useState(false)
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
    `px-1 py-1 text-[15px] border-b-2 transition-colors ${
      isActive
        ? 'border-ink text-ink font-bold'
        : 'border-transparent text-mute hover:text-ink'
    }`

  const leaveToStart = () => {
    setQuitModal(false)
    resetAllGameState()
    navigate('/setup')
  }

  const handleConfirm = () => {
    setConfirm(false)
    onAdvance?.()
  }

  const handleAdvanceClick = () => {
    if (!requirementMet) { setReqModal(true); return }
    setConfirm(true)
  }

  const modalBox = 'w-full max-w-sm bg-paper-card border-4 border-double border-ink p-7 flex flex-col gap-5'
  const ghostBtn = 'flex-1 h-11 border border-ink bg-transparent text-ink hover:bg-paper-deep text-sm font-medium transition-colors'

  return (
    <>
      <header className="bg-paper shrink-0 border-b-4 border-double border-ink">

        {advanceError && (
          <div className="flex items-center gap-2 px-6 py-1.5 bg-paper-card border-b border-up text-up text-xs">
            <AlertTriangle size={12} />
            {advanceError}
          </div>
        )}
        <div className="min-h-14 py-2 flex flex-wrap items-center px-6 gap-x-7 gap-y-2">
          <button
            onClick={() => navigate('/')}
            className="font-serif font-black text-[28px] leading-none tracking-tight text-ink"
          >
            shiftStocks
          </button>

          <nav className="flex items-center gap-5">
            <NavLink to="/"     end className={tabClass}>홈</NavLink>
            <NavLink to="/trade"    className={tabClass}>거래</NavLink>
            <NavLink to="/news"     className={tabClass}>뉴스</NavLink>
            {mode === 'contest' && contest && (
              <NavLink to={`/leaderboard?code=${encodeURIComponent(contest.code)}`} className={tabClass}>순위표</NavLink>
            )}
            {!(mode === 'contest' && !finished) && (
            <button
                onClick={() => navigate(adminAuth ? '/admin/dashboard' : '/admin')}
                className="flex items-center gap-1.5 px-1 py-1 text-sm text-mute hover:text-ink transition-colors"
              >
                <Lock size={13} />
                관리자
              </button>
            )}
            {/* 시뮬레이션만: 지금 게임을 포기하고 처음(타이틀) 화면으로. 대회 중에는 포기할 수 없다 */}
            {mode === 'simulation' && (
              <button
                onClick={() => (finished ? leaveToStart() : setQuitModal(true))}
                className="flex items-center gap-1.5 px-1 py-1 text-sm text-mute hover:text-ink transition-colors"
              >
                <House size={13} />
                처음 화면으로
              </button>
            )}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            {mode === 'contest' && contest && (
              <span className="text-ink-soft text-sm max-w-[160px] truncate" title={contest.title || contest.code}>
                대회 {contest.title || contest.code}
              </span>
            )}
            {countdown !== null && (
              <span
                role="timer"
                className={`flex items-center gap-1 text-sm font-bold tabular-nums ${countdown <= 60_000 ? 'text-up' : 'text-ink'}`}
                title="이번 분기 제한시간"
              >
                <Clock size={14} />
                {formatCountdown(countdown)}
              </span>
            )}
            <span className="text-ink-soft text-sm">YEAR {currentYear} Q{currentQuarter}</span>
            {totalQuarters <= 12 ? (
              <div className="flex items-center" aria-label={`전체 ${totalQuarters}분기 중 ${qIndex}분기`}>
                {Array.from({ length: totalQuarters }, (_, i) => i + 1).map((q, i) => {
                  const completed = finished || q < qIndex
                  const current   = !finished && q === qIndex
                  return (
                    <div key={q} className="flex items-center">
                      {i > 0 && (
                        <div className={`w-3 h-px ${completed || current ? 'bg-ink' : 'bg-rule'}`} />
                      )}
                      <div className={`w-3 h-3 box-border ${
                        completed ? 'bg-ink'
                        : current  ? 'border-2 border-ink bg-paper'
                        : 'border border-mute bg-transparent'
                      }`} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <span className="text-ink-soft text-sm">{qIndex} / {totalQuarters}</span>
            )}
          </div>

          <button
            onClick={finished ? openFinalResult : handleAdvanceClick}
            disabled={isAdvancing || waiting}
            className={`flex items-center gap-2 h-10 px-5 text-sm font-bold transition-colors disabled:bg-rule disabled:text-mute disabled:border-rule ${
              requirementMet || finished
                ? 'bg-ink text-paper hover:bg-ink-soft'
                : 'bg-transparent text-ink border-2 border-ink hover:bg-paper-deep'
            }`}
          >
            {isAdvancing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                진행 중...
              </>
            ) : finished ? (
              '최종 결과 보기'
            ) : waiting ? (
              '다른 참가자 기다리는 중'
            ) : isLastQuarter ? (
              '마지막 분기 마감'
            ) : isContest ? (
              '이번 분기 마감'
            ) : (
              '다음 분기로'
            )}
          </button>
        </div>
      </header>

      {/* 분기 진행 조건 모달 */}
      {reqModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setReqModal(false)}
        >
          <div className={modalBox} onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldAlert size={30} className="text-ink" />
              <h2 className="font-serif font-black text-xl">{requirementMet ? '분기 진행 조건 달성' : '분기 진행 조건 미충족'}</h2>
            </div>

            <div className="border-y border-ink flex flex-col text-sm">
              <div className="flex items-center justify-between py-3 border-b border-rule">
                <span className="text-mute">서로 다른 종목 매수</span>
                <span className={`font-bold ${stockCount >= REQUIRED_STOCKS ? 'text-ink' : 'text-up'}`}>
                  {stockCount} / {REQUIRED_STOCKS}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-rule">
                <span className="text-mute">서로 다른 섹터 매수</span>
                <span className={`font-bold ${sectorCount >= REQUIRED_SECTORS ? 'text-ink' : 'text-up'}`}>
                  {sectorCount} / {REQUIRED_SECTORS}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-mute">이전 분기 대비 포트폴리오 변경</span>
                <span className={`font-bold ${inventoryChanged ? 'text-ink' : 'text-up'}`}>
                  {inventoryChanged ? '충족' : '미충족'}
                </span>
              </div>
            </div>

            <button onClick={() => setReqModal(false)} className={`${ghostBtn} flex-none w-full`}>
              확인
            </button>
          </div>
        </div>
      )}

      {/* 시뮬레이션 포기 확인 모달 */}
      {quitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setQuitModal(false)}
        >
          <div className={modalBox} role="alertdialog" aria-modal="true" aria-label="시뮬레이션 포기" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 text-center">
              <House size={30} className="text-ink" />
              <h2 className="font-serif font-black text-xl">시뮬레이션을 포기할까요?</h2>
              <p className="text-ink-soft text-sm leading-relaxed">
                현재 진행 중인 시뮬레이션을 포기하고<br />
                처음 화면으로 돌아갑니다.<br />
                <span className="text-up text-xs mt-1 block">거래 내역과 보유 종목이 모두 사라지며 되돌릴 수 없습니다.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setQuitModal(false)} className={ghostBtn}>계속 진행</button>
              <button onClick={leaveToStart} className="flex-1 h-11 bg-up hover:brightness-110 text-white text-sm font-bold transition">
                포기하고 나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 분기 진행 확인 모달 */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setConfirm(false)}
        >
          <div className={modalBox} onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle size={30} className="text-ink" />
              <h2 className="font-serif font-black text-xl">{isContest ? '이번 분기 마감' : isLastQuarter ? '마지막 분기 마감' : '분기 진행 확인'}</h2>
              <p className="text-ink-soft text-sm leading-relaxed">
                {isContest ? (
                  <>
                    YEAR {currentYear} Q{currentQuarter}를 마감하시겠습니까?<br />
                    <span className="text-mute text-xs mt-1 block">마감하면 이번 분기에는 더 거래할 수 없습니다. 모든 참가자가 마감하거나 제한시간이 지나면 함께 다음 분기로 넘어갑니다.</span>
                  </>
                ) : (
                  <>
                    YEAR {currentYear} Q{currentQuarter}를 마감하고<br />
                    {isLastQuarter ? '최종 결과를 확인하시겠습니까?' : '다음 분기로 진행하시겠습니까?'}<br />
                    <span className="text-mute text-xs mt-1 block">진행 후에는 되돌릴 수 없습니다.</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className={ghostBtn}>
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-11 bg-ink hover:bg-ink-soft text-paper text-sm font-bold transition-colors"
              >
                {isContest || isLastQuarter ? '마감하기' : '진행하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
