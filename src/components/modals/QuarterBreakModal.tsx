import { useEffect, useState } from 'react'
import { useGameStore, roundSecondsOf } from '../../stores/gameStore'
import { useRoundBreak } from '../../hooks/useRoundTimer'
import { fetchLeaderboard, type LeaderboardRow } from '../../services/contest'
import { ROUND_BREAK_MS } from '../../utils/constants'

const REFRESH_MS = 2_000   // 휴식 중에는 다른 참가자의 점수가 늦게 올라오므로 자주 새로 가져온다
const TOP = 3   // 분기 사이에는 1·2·3위만 보여 준다

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
/**
 * 방금 끝난 분기(ended)까지의 변화를 반영한 수익률.
 * 아직 그 분기 점수를 올리지 못한 참가자는 null — 지난 분기 값으로 순위에 끼지 않고 "집계 중"으로 따로 센다.
 * 이미 포기한 참가자는 포기한 시점의 점수로 계속 순위에 남는다.
 */
function scoreAfter(p: LeaderboardRow, ended: number): number | null {
  const v = p.quarter_returns?.[ended - 1]
  if (v !== null && v !== undefined) return Number(v)
  if (p.forfeited_quarter != null && p.forfeited_quarter <= ended && p.return_pct !== null) return Number(p.return_pct)
  return null
}

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

  // 끝난 분기의 점수가 올라온 참가자만 그 수익률로 줄 세운다 (같으면 서버 순서 유지)
  const scored = (players ?? [])
    .map(p => ({ p, v: scoreAfter(p, br.endedQuarter) }))
    .filter((x): x is { p: LeaderboardRow; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v)
  const list = scored
  const pendingCount = (players ?? []).length - scored.length
  const myIdx = list.findIndex(x => x.p.nickname === userName)
  const myPending = (players ?? []).some(p => p.nickname === userName) && myIdx < 0
  const top = list.slice(0, TOP)
  const showMine = myIdx >= TOP

  const row = ({ p, v }: { p: LeaderboardRow; v: number }, rank: number) => {
    const mine = p.nickname === userName
    const pct = v
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label={`${br.endedQuarter}분기 종료, 순위`}>
      <div className="w-full max-w-md bg-paper-card border-4 border-double border-ink flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b-2 border-ink">
          <p className="m-0 text-xs text-mute">{contest.title || contest.code} · {br.endedQuarter}분기까지의 변화를 반영한 순위</p>
          <h2 className="font-serif font-black text-2xl m-0 mt-1">{br.endedQuarter}분기 결과 순위</h2>
        </div>

        {/* 남은 휴식 시간 — 이 줄이 다 줄어들면 팝업이 닫히고 다음 분기가 시작된다 */}
        <div className="h-1.5 bg-rule" aria-hidden="true">
          <div className="h-full bg-ink" style={{ width: `${progress * 100}%`, transition: 'width 250ms linear' }} />
        </div>

        <div className="px-6 py-4 flex flex-col gap-3">
          {players === null ? (
            <p className="m-0 text-sm text-mute py-6 text-center">순위를 불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="m-0 text-sm text-mute py-6 text-center">순위를 집계하는 중입니다…</p>
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
              {myPending && <p className="m-0 text-sm text-ink-soft">내 점수를 집계하는 중입니다…</p>}
              {pendingCount > 0 && <p className="m-0 text-xs text-mute">{pendingCount}명의 점수는 아직 집계 중입니다. 곧 순위가 바뀔 수 있습니다.</p>}
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
