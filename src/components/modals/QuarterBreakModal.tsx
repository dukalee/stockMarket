import { useEffect, useState } from 'react'
import { useGameStore, roundSecondsOf } from '../../stores/gameStore'
import { useRoundBreak } from '../../hooks/useRoundTimer'
import { fetchLeaderboard, type LeaderboardRow } from '../../services/contest'
import { ROUND_BREAK_MS } from '../../utils/constants'

const REFRESH_MS = 2_000   // 휴식 중에는 다른 참가자의 점수가 늦게 올라오므로 자주 새로 가져온다
const TOP = 5

const fmtPct = (n: number | null) => (n === null ? '–' : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`)
const pctColor = (n: number | null) => (n === null || n === 0 ? 'text-ink' : n > 0 ? 'text-up' : 'text-down')

/** 1~3위를 눈에 띄게: 1위는 먹색 바탕, 2·3위는 굵은 테두리 */
export function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? 'bg-ink text-paper border-2 border-ink' :
    rank === 2 ? 'border-2 border-ink text-ink' :
    rank === 3 ? 'border border-ink text-ink' :
                 'text-mute'
  return (
    <span
      aria-label={`${rank}위`}
      className={`inline-flex items-center justify-center w-9 h-9 shrink-0 font-serif font-black tabular-nums ${rank <= 3 ? 'text-lg' : 'text-sm'} ${cls}`}
    >
      {rank}
    </span>
  )
}

/**
 * 대회 모드: 분기가 끝나고 다음 분기가 시작되기 전 10초 동안 현재 순위를 보여 준다.
 * 휴식이 끝나면(서버가 정한 다음 분기 시작 시각) 저절로 닫히고, 그때부터 제한시간이 다시 줄기 시작한다.
 */
export default function QuarterBreakModal() {
  const contest  = useGameStore(s => s.contest)
  const userName = useGameStore(s => s.userName)
  const br       = useRoundBreak()

  const [players, setPlayers] = useState<LeaderboardRow[] | null>(null)
  const active = br !== null
  const code   = contest?.code
  const ended  = br?.endedQuarter

  useEffect(() => {
    if (!active || !code) return
    let cancelled = false
    const load = async () => {
      try {
        const d = await fetchLeaderboard(code)
        if (!cancelled) setPlayers(d.players)
      } catch { /* 순위를 못 가져와도 팝업은 카운트다운만 보여 준다 */ }
    }
    void load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(id); setPlayers(null) }
  }, [active, code, ended])

  if (!br || !contest) return null

  const secs = Math.max(1, Math.ceil(br.remainingMs / 1000))
  const progress = Math.min(1, Math.max(0, br.remainingMs / ROUND_BREAK_MS))
  const minutes = Math.round((roundSecondsOf(contest) / 60) * 10) / 10

  const list = players ?? []
  const myIdx = list.findIndex(p => p.nickname === userName)
  const top = list.slice(0, TOP)
  const showMine = myIdx >= TOP

  const row = (p: LeaderboardRow, rank: number) => {
    const mine = p.nickname === userName
    const pct = p.return_pct
    return (
      <li key={p.nickname} className={`flex items-center gap-3 py-2.5 border-b border-rule ${mine ? 'bg-paper-deep px-2 -mx-2' : ''} ${rank === 1 ? 'border-b-2 border-ink' : ''}`}>
        <RankBadge rank={rank} />
        <span className={`flex-1 min-w-0 truncate ${rank <= 3 ? 'font-serif font-black text-base' : 'font-medium text-sm'}`}>
          {p.nickname}
          {mine && <span className="ml-1.5 text-[11px] text-mute font-sans font-normal">나</span>}
          {p.forfeited_quarter != null && <span className="ml-1.5 text-[11px] text-up font-sans font-bold">{p.forfeited_quarter}분기 포기</span>}
        </span>
        <span className={`tabular-nums font-bold ${rank <= 3 ? 'text-base' : 'text-sm'} ${pctColor(pct)}`}>{fmtPct(pct)}</span>
      </li>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label={`${br.endedQuarter}분기 종료, 현재 순위`}>
      <div className="w-full max-w-md bg-paper-card border-4 border-double border-ink flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b-2 border-ink">
          <p className="m-0 text-xs text-mute">{contest.title || contest.code} · {br.endedQuarter}분기 종료</p>
          <h2 className="font-serif font-black text-2xl m-0 mt-1">현재 순위</h2>
        </div>

        {/* 남은 휴식 시간 — 이 줄이 다 줄어들면 팝업이 닫히고 다음 분기가 시작된다 */}
        <div className="h-1.5 bg-rule" aria-hidden="true">
          <div className="h-full bg-ink" style={{ width: `${progress * 100}%`, transition: 'width 250ms linear' }} />
        </div>

        <div className="px-6 py-4 flex flex-col gap-3">
          {players === null ? (
            <p className="m-0 text-sm text-mute py-6 text-center">순위를 불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="m-0 text-sm text-mute py-6 text-center">아직 집계된 순위가 없습니다.</p>
          ) : (
            <>
              <ol className="m-0 p-0 list-none">
                {top.map((p, i) => row(p, i + 1))}
                {showMine && (
                  <>
                    <li aria-hidden="true" className="py-1 text-center text-mute text-xs">⋯</li>
                    {row(list[myIdx], myIdx + 1)}
                  </>
                )}
              </ol>
              {myIdx >= 0 && (
                <p className="m-0 text-sm text-ink-soft">
                  내 순위 <b className="text-ink">{list.length}명 중 {myIdx + 1}위</b>
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-ink bg-paper-deep text-center">
          <p className="m-0 font-serif font-black text-xl" aria-live="off">
            다음 분기까지 <span className="tabular-nums">{secs}</span>초
          </p>
          <p className="m-0 mt-1 text-xs text-ink-soft">시작과 함께 제한시간 {minutes}분이 다시 시작됩니다.</p>
        </div>
      </div>
    </div>
  )
}
