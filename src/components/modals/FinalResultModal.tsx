import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../stores/gameStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'
import { computeTotalAssets, syncContestScore } from '../../services/contestSync'
import { fetchLeaderboard } from '../../services/contest'
import { resetAllGameState } from '../../services/gameReset'

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

/** 마지막 분기를 마감하면 뜨는 최종 결과 */
export default function FinalResultModal() {
  const navigate = useNavigate()
  const phase    = useGameStore(s => s.phase)
  const show     = useGameStore(s => s.showFinalResult)
  const mode     = useGameStore(s => s.mode)
  const contest  = useGameStore(s => s.contest)
  const userName = useGameStore(s => s.userName)
  const initial  = useGameStore(s => s.initialCapital)
  const penalties = useGameStore(s => s.penalties)
  const syncError = useGameStore(s => s.scoreSyncError)
  const close    = useGameStore(s => s.closeFinalResult)
  // 구독해서 값이 바뀌면 다시 계산되도록 한다
  usePortfolioStore(s => s.cash)
  useMarketStore(s => s.stocks)

  const [rank, setRank] = useState<{ place: number; total: number } | null>(null)
  const [retrying, setRetrying] = useState(false)

  const open = phase === 'finished' && show
  const code = contest?.code

  // 대회 모드: 내 현재 순위를 가져온다
  useEffect(() => {
    if (!open || mode !== 'contest' || !code || syncError) return
    let cancelled = false
    fetchLeaderboard(code)
      .then(d => {
        if (cancelled) return
        const i = d.players.findIndex(p => p.nickname === userName)
        if (i >= 0) setRank({ place: i + 1, total: d.players.length })
      })
      .catch(() => { /* 순위를 못 가져와도 결과 화면은 보여준다 */ })
    return () => { cancelled = true }
  }, [open, mode, code, userName, syncError])

  if (!open) return null

  const total = computeTotalAssets()
  const pct   = ((total - initial) / initial) * 100
  const up    = pct > 0, down = pct < 0

  const retry = async () => { setRetrying(true); await syncContestScore(); setRetrying(false) }
  const newGame = () => { resetAllGameState(); navigate('/setup') }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="최종 결과">
      <div className="w-full max-w-md bg-paper-card border-4 border-double border-ink p-8 flex flex-col gap-5">
        <div className="text-center">
          <p className="m-0 text-xs text-mute">{mode === 'contest' && contest ? `대회 ${contest.title || contest.code}` : '시뮬레이션'}</p>
          <h2 className="font-serif font-black text-3xl m-0 mt-1">게임 종료</h2>
          <p className="m-0 mt-1 text-sm text-ink-soft">{userName}님의 최종 결과</p>
        </div>

        <div className="border-y-2 border-ink grid grid-cols-2 divide-x divide-rule">
          <div className="py-4 px-3">
            <p className="m-0 text-xs text-mute">최종 총 자산</p>
            <p className="m-0 font-serif font-black text-2xl">{fmt(total)}</p>
          </div>
          <div className="py-4 px-4">
            <p className="m-0 text-xs text-mute">수익률</p>
            <p className={`m-0 font-serif font-black text-2xl ${up ? 'text-up' : down ? 'text-down' : ''}`}>
              {up ? '▲' : down ? '▼' : '–'} {Math.abs(pct).toFixed(2)}%
            </p>
          </div>
        </div>

        <dl className="m-0 flex flex-col gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-mute">초기 자본</dt><dd className="m-0">{fmt(initial)}</dd></div>
          <div className="flex justify-between">
            <dt className="text-mute">손익</dt>
            <dd className={`m-0 font-bold ${up ? 'text-up' : down ? 'text-down' : ''}`}>{total >= initial ? '+' : '-'}{fmt(Math.abs(total - initial))}</dd>
          </div>
          {mode === 'contest' && (
            <div className="flex justify-between">
              <dt className="text-mute">시간 초과 페널티</dt>
              <dd className="m-0">{penalties.length}회</dd>
            </div>
          )}
          {mode === 'contest' && rank && (
            <div className="flex justify-between">
              <dt className="text-mute">현재 순위</dt>
              <dd className="m-0 font-bold">{rank.total}명 중 {rank.place}위</dd>
            </div>
          )}
        </dl>

        {mode === 'contest' && syncError && (
          <div className="border border-up p-3 text-xs text-up leading-relaxed">
            {syncError}
            <button onClick={retry} disabled={retrying} className="ml-2 underline font-bold">
              {retrying ? '전송 중...' : '점수 다시 전송'}
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={close} className="flex-1 h-11 border border-ink text-ink hover:bg-paper-deep text-sm font-medium transition-colors">
            내 기록 둘러보기
          </button>
          {/* 대회의 순위표는 관리자만 볼 수 있다. 대회에서는 새 게임 버튼도 두지 않는다 (결과를 보고 다시 도전하는 것을 막는다) */}
          {mode !== 'contest' && (
            <button onClick={newGame} className="flex-1 h-11 bg-up hover:brightness-110 text-white text-sm font-bold transition">
              새 게임 시작
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
