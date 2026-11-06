import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Lock, AlertTriangle, ShieldAlert, Clock, House, Flag } from 'lucide-react'
import { useGameStore, quarterIndexOf } from '../../stores/gameStore'
import { useRoundCountdown, formatCountdown } from '../../hooks/useRoundTimer'
import { useMarketStore } from '../../stores/marketStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useContestRoundStore } from '../../stores/contestRoundStore'
import { resetAllGameState } from '../../services/gameReset'
import { computeTotalAssets } from '../../services/contestSync'
import { forfeitWithFallback } from '../../services/pendingForfeit'

interface NavBarProps {
  isAdvancing?: boolean
  onAdvance?: () => void
  advanceError?: string | null
}

const REQUIRED_SECTORS = 2
const REQUIRED_STOCKS  = 2

export default function NavBar({ isAdvancing = false, onAdvance, advanceError }: NavBarProps) {
  const navigate       = useNavigate()
  const { pathname }   = useLocation()
  const onAdmin        = pathname.startsWith('/admin')   // 관리자 화면: 게임용 메뉴와 버튼이 필요 없다
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const phase          = useGameStore(s => s.phase)
  const adminAuth      = useGameStore(s => s.adminAuth)
  const mode           = useGameStore(s => s.mode)
  const contest        = useGameStore(s => s.contest)
  const totalQuarters  = useGameStore(s => s.totalQuarters)
  const openFinalResult = useGameStore(s => s.openFinalResult)
  const roundSubmitted  = useGameStore(s => s.roundSubmitted)
  const userName        = useGameStore(s => s.userName)
  const initialCapital  = useGameStore(s => s.initialCapital)
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
  const [forfeitModal, setForfeitModal] = useState(false)
  const [forfeitBusy,  setForfeitBusy]  = useState(false)

  // 대회를 진행하는 동안만 포기할 수 있다 (대기실·종료 후에는 해당 없음)
  const canForfeit = isContest && !!contest && (phase === 'playing' || phase === 'advancing')

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

  // 대회 포기: 지금 시점의 총 자산이 최종 기록이 되고, 포기한 분기가 남는다. 끝나면 타이틀 화면으로 돌아간다.
  // 서버에 연결할 수 없어도 포기는 진행된다 — 이 기기에 저장해 두었다가 연결되면 자동으로 서버에 보낸다.
  const handleForfeit = async () => {
    if (!contest) return
    setForfeitBusy(true)
    await forfeitWithFallback({ code: contest.code, nickname: userName, totalAssets: computeTotalAssets(), quarter: qIndex })
    setForfeitBusy(false)
    setForfeitModal(false)
    resetAllGameState()
    useContestRoundStore.getState().clear()
    navigate('/setup')
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

          {!onAdmin && (
          <nav className="flex items-center gap-5">
            <NavLink to="/"     end className={tabClass}>홈</NavLink>
            <NavLink to="/trade"    className={tabClass}>거래</NavLink>
            <NavLink to="/news"     className={tabClass}>뉴스</NavLink>
            {/* 관리자 버튼은 홈 화면(홈 탭)에서만 보인다. 거래·뉴스·관리자 화면 등 다른 화면에서는 보이지 않는다 */}
            {!(mode === 'contest' && !finished) && pathname === '/' && (
            <button
                onClick={() => navigate(adminAuth ? '/admin/contests' : '/admin')}
                className="flex items-center gap-1.5 px-1 py-1 text-sm text-mute hover:text-ink transition-colors"
              >
                <Lock size={13} />
                관리자
              </button>
            )}
          </nav>
          )}

          <div className="flex-1" />

          {!onAdmin && (
          <>
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

          <div className="flex items-center gap-3">
          {canForfeit && (
            <button
              onClick={() => setForfeitModal(true)}
              disabled={isAdvancing}
              className="flex items-center gap-1.5 h-10 px-4 text-sm font-bold bg-up text-white hover:brightness-110 transition disabled:opacity-40"
            >
              <Flag size={14} />
              대회 포기
            </button>
          )}
          {/* 시뮬레이션: 지금 게임을 그만두고 처음(타이틀) 화면으로. 끝난 게임에서는 확인 없이 이동한다 */}
          {mode === 'simulation' && (
            <button
              onClick={() => (finished ? leaveToStart() : setQuitModal(true))}
              disabled={isAdvancing}
              className="flex items-center gap-1.5 h-10 px-4 text-sm font-bold bg-up text-white hover:brightness-110 transition disabled:opacity-40"
            >
              <House size={14} />
              처음 화면으로
            </button>
          )}
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
          </>
          )}
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

      {/* 대회 포기 확인 모달 — 포기한 시점의 점수로 최종 기록되고, 같은 대회에는 다시 들어올 수 없다 */}
      {forfeitModal && canForfeit && (() => {
        const total = computeTotalAssets()
        const pct = initialCapital > 0 ? ((total - initialCapital) / initialCapital) * 100 : 0
        const color = pct > 0 ? 'text-up' : pct < 0 ? 'text-down' : 'text-ink'
        return (
          <div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-ink/60 p-4"
            onClick={() => { if (!forfeitBusy) setForfeitModal(false) }}
          >
            <div className={modalBox} role="alertdialog" aria-modal="true" aria-label="대회 포기" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-3 text-center">
                <Flag size={30} className="text-up" />
                <h2 className="font-serif font-black text-xl m-0">대회를 포기할까요?</h2>
                <p className="text-ink-soft text-sm leading-relaxed m-0">
                  지금 점수로 최종 기록되고 <b className="text-ink">{qIndex}분기 포기</b>로 표시됩니다.<br />
                  처음 화면으로 돌아가며, 이 대회에는 다시 참가할 수 없습니다.
                </p>
              </div>

              <div className="border-y border-ink grid grid-cols-2 divide-x divide-rule text-center">
                <div className="py-3">
                  <p className="m-0 text-xs text-mute">최종 기록 자산</p>
                  <p className="m-0 mt-1 font-serif font-black text-lg tabular-nums">₩{Math.round(total).toLocaleString('ko-KR')}</p>
                </div>
                <div className="py-3">
                  <p className="m-0 text-xs text-mute">수익률</p>
                  <p className={`m-0 mt-1 font-serif font-black text-lg tabular-nums ${color}`}>
                    {pct > 0 ? '▲' : pct < 0 ? '▼' : '–'} {Math.abs(pct).toFixed(2)}%
                  </p>
                </div>
              </div>

              <p className="m-0 text-up text-xs text-center">되돌릴 수 없습니다.</p>
              <p className="m-0 text-mute text-xs text-center leading-relaxed">서버에 연결되지 않아도 포기됩니다. 연결되면 기록이 자동으로 전달됩니다.</p>

              <div className="flex gap-3">
                <button onClick={() => setForfeitModal(false)} disabled={forfeitBusy} className={`${ghostBtn} disabled:opacity-40`}>
                  계속 진행
                </button>
                <button
                  onClick={handleForfeit}
                  disabled={forfeitBusy}
                  className="flex-1 h-11 bg-up hover:brightness-110 disabled:opacity-50 text-white text-sm font-bold transition"
                >
                  {forfeitBusy ? '포기하는 중…' : '대회 포기'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
