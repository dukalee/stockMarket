import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../stores/gameStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'
import { computeTotalAssets, syncContestScore } from '../../services/contestSync'
import { fetchLeaderboard, type LeaderboardRow } from '../../services/contest'
import { RankBadge } from './QuarterBreakModal'
import { resetAllGameState } from '../../services/gameReset'
import { useContestRoundStore } from '../../stores/contestRoundStore'

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

  const [players, setPlayers] = useState<LeaderboardRow[] | null>(null)
  const [retrying, setRetrying] = useState(false)

  const open = phase === 'finished' && show
  const code = contest?.code

  // 대회 모드: 모든 참가자의 최종 순위를 가져온다. 다른 참가자의 마지막 점수가 늦게 올라오므로 3초마다 새로 가져온다.
  useEffect(() => {
    if (!open || mode !== 'contest' || !code) return
    let cancelled = false
    const load = () => {
      fetchLeaderboard(code)
        .then(d => { if (!cancelled) setPlayers(d.players) })
        .catch(() => { /* 순위를 못 가져와도 결과 화면은 보여준다 */ })
    }
    load()
    const id = window.setInterval(load, 3_000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [open, mode, code])

  if (!open) return null

  const total = computeTotalAssets()
  const pct   = ((total - initial) / initial) * 100
  const up    = pct > 0, down = pct < 0

  const isContest = mode === 'contest'
  const myIdx = players ? players.findIndex(p => p.nickname === userName) : -1
  const waitingCount = players ? players.filter(p => !p.finished && p.forfeited_quarter == null).length : 0

  const retry = async () => { setRetrying(true); await syncContestScore(); setRetrying(false) }
  const newGame = () => { resetAllGameState(); navigate('/setup') }
  // 대회 종료: 대회 기록을 정리하고 타이틀 화면으로 간다
  const endContest = () => { resetAllGameState(); useContestRoundStore.getState().clear(); navigate('/setup') }

  return (
    <div className={isContest ? 'fixed inset-0 z-50 bg-paper overflow-y-auto p-4 sm:p-8' : 'fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4'} role="dialog" aria-modal="true" aria-label={isContest ? '대회 최종 순위' : '최종 결과'}>
      <div className={`w-full ${isContest ? 'max-w-2xl mx-auto' : 'max-w-md'} bg-paper-card border-4 border-double border-ink p-8 flex flex-col gap-5`}>
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
          {isContest && myIdx >= 0 && players && (
            <div className="flex justify-between">
              <dt className="text-mute">내 순위</dt>
              <dd className="m-0 font-bold">{players.length}명 중 {myIdx + 1}위</dd>
            </div>
          )}
        </dl>

        {/* 대회: 모든 참가자의 최종 랭킹 */}
        {isContest && (
          <section aria-label="전체 순위" className="flex flex-col gap-2">
            <h3 className="font-serif font-black text-lg m-0 border-b-2 border-ink pb-1">최종 순위</h3>
            {players === null ? (
              <p className="m-0 text-sm text-mute py-4 text-center">순위를 불러오는 중…</p>
            ) : (
              <>
                <ol className="m-0 p-0 list-none">
                  {players.map((p, i) => {
                    const rank = i + 1
                    const mine = p.nickname === userName
                    const pr = p.return_pct
                    return (
                      <li key={p.nickname} className={`flex items-center gap-3 py-2 border-b border-rule ${mine ? 'bg-paper-deep px-2 -mx-2' : ''} ${rank === 1 ? 'border-b-2 border-ink' : ''}`}>
                        <RankBadge rank={rank} />
                        <span className={`flex-1 min-w-0 truncate ${rank <= 3 ? 'font-serif font-black text-base' : 'font-medium text-sm'}`}>
                          {p.nickname}
                          {mine && <span className="ml-1.5 text-[11px] text-mute font-sans font-normal">나</span>}
                          {p.forfeited_quarter != null && <span className="ml-1.5 text-[11px] text-up font-sans font-bold">{p.forfeited_quarter}분기 포기</span>}
                          {p.forfeited_quarter == null && !p.finished && <span className="ml-1.5 text-[11px] text-mute font-sans">집계 중</span>}
                        </span>
                        <span className={`tabular-nums font-bold ${rank <= 3 ? 'text-base' : 'text-sm'} ${pr === null || pr === 0 ? 'text-ink' : pr > 0 ? 'text-up' : 'text-down'}`}>
                          {pr === null ? '–' : `${pr > 0 ? '+' : ''}${Number(pr).toFixed(2)}%`}
                        </span>
                      </li>
                    )
                  })}
                </ol>
                {waitingCount > 0 && <p className="m-0 text-xs text-mute">{waitingCount}명의 최종 점수를 집계하는 중입니다. 순위는 자동으로 갱신됩니다.</p>}
              </>
            )}
          </section>
        )}

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
          {/* 대회: 새 게임 버튼 대신 "대회 종료" — 누르면 타이틀 화면으로 간다 (결과를 보고 다시 도전하는 것을 막는다) */}
          {isContest ? (
            <button onClick={endContest} className="flex-1 h-11 bg-up hover:brightness-110 text-white text-sm font-bold transition">
              대회 종료
            </button>
          ) : (
            <button onClick={newGame} className="flex-1 h-11 bg-up hover:brightness-110 text-white text-sm font-bold transition">
              새 게임 시작
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
