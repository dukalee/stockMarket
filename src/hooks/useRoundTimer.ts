import { useEffect, useState } from 'react'
import { useGameStore, roundSecondsOf } from '../stores/gameStore'

/**
 * 대회 모드의 이번 분기 남은 시간(ms). 대회가 아니거나 분기 진행 중이 아니면 null.
 * 시작 시각은 서버가 정한 라운드 시작 시각이고, 시계는 서버 시각 오프셋으로 보정한다.
 * 0이 돼도 여기서는 아무것도 하지 않는다 — 분기를 넘기고 페널티를 정하는 것은 서버다.
 */
export function useRoundCountdown(): number | null {
  const mode      = useGameStore(s => s.mode)
  const phase     = useGameStore(s => s.phase)
  const startedAt = useGameStore(s => s.quarterStartedAt)
  const contest   = useGameStore(s => s.contest)
  const offset    = useGameStore(s => s.clockOffsetMs)

  const active = mode === 'contest' && phase === 'playing' && startedAt !== null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [active])

  if (!active || startedAt === null) return null
  return Math.max(0, roundSecondsOf(contest) * 1000 - (now + offset - startedAt))
}

export const formatCountdown = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
