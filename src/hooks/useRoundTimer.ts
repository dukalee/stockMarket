import { useEffect, useState } from 'react'
import { useGameStore, roundSecondsOf } from '../stores/gameStore'
import { useContestRoundStore } from '../stores/contestRoundStore'

/** 일정한 간격으로 다시 그려지는 현재 시각(ms). enabled 가 false 면 멈춘다. */
function useNow(intervalMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])
  return now
}

/**
 * 대회 모드의 이번 분기 남은 시간(ms). 대회가 아니거나 분기 진행 중이 아니면 null.
 * 시작 시각은 서버가 정한 라운드 시작 시각이고, 시계는 서버 시각 오프셋으로 보정한다.
 * 분기 사이 휴식 중에는 시작 시각이 아직 미래이므로 제한시간 전체(예: 5분)로 고정해 보여 준다 — 휴식이 끝나야 줄기 시작한다.
 * 0이 돼도 여기서는 아무것도 하지 않는다 — 분기를 넘기고 페널티를 정하는 것은 서버다.
 */
export function useRoundCountdown(): number | null {
  const mode      = useGameStore(s => s.mode)
  const phase     = useGameStore(s => s.phase)
  const startedAt = useGameStore(s => s.quarterStartedAt)
  const contest   = useGameStore(s => s.contest)
  const offset    = useGameStore(s => s.clockOffsetMs)

  const active = mode === 'contest' && phase === 'playing' && startedAt !== null
  const now = useNow(500, active)

  if (!active || startedAt === null) return null
  const total = roundSecondsOf(contest) * 1000
  return Math.min(total, Math.max(0, total - (now + offset - startedAt)))
}

/**
 * 대회 모드의 "분기 사이 휴식" 상태. 휴식 중이 아니면 null.
 * 서버가 다음 분기 시작 시각을 몇 초 뒤로 잡아 두므로, 그 시각까지 남은 시간이 곧 휴식 시간이다.
 * 서버 상태에서 계산하므로 새로고침해도, 분기를 늦게 따라가도 같은 시간에 끝난다.
 *   endedQuarter: 방금 끝난 분기 번호 (1부터)
 */
export function useRoundBreak(): { remainingMs: number; endedQuarter: number } | null {
  const mode    = useGameStore(s => s.mode)
  const phase   = useGameStore(s => s.phase)
  const contest = useGameStore(s => s.contest)
  const offset  = useGameStore(s => s.clockOffsetMs)
  const rs      = useContestRoundStore(s => s.state)

  const candidate = mode === 'contest' && !!contest && (phase === 'playing' || phase === 'advancing')
    && !!rs && rs.status === 'running' && rs.currentRound >= 2 && rs.roundStartedAt !== null
  const now = useNow(250, candidate)

  if (!candidate || !rs || rs.roundStartedAt === null) return null
  const remainingMs = rs.roundStartedAt - (now + offset)
  if (remainingMs <= 0) return null
  return { remainingMs, endedQuarter: rs.currentRound - 1 }
}

export const formatCountdown = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
