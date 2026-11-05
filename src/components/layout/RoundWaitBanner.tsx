import { Loader2 } from 'lucide-react'
import { useGameStore, quarterIndexOf } from '../../stores/gameStore'
import { useContestRoundStore } from '../../stores/contestRoundStore'
import { useRoundCountdown, formatCountdown } from '../../hooks/useRoundTimer'

/** 대회 모드: 이번 분기를 마감하고 다른 참가자를 기다리는 동안 보이는 안내 */
export default function RoundWaitBanner() {
  const mode           = useGameStore(s => s.mode)
  const phase          = useGameStore(s => s.phase)
  const roundSubmitted = useGameStore(s => s.roundSubmitted)
  const qIndex         = useGameStore(s => quarterIndexOf(s.currentYear, s.currentQuarter))
  const rs             = useContestRoundStore(s => s.state)
  const countdown      = useRoundCountdown()

  if (mode !== 'contest' || phase !== 'playing' || roundSubmitted < qIndex) return null

  return (
    <div role="status" className="shrink-0 border-b border-ink bg-paper-deep px-6 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
      <Loader2 size={14} className="animate-spin" />
      <span className="font-bold">마감했습니다. 다른 참가자를 기다리는 중입니다.</span>
      {rs && <span className="text-ink-soft">{rs.donePlayers} / {rs.totalPlayers}명 마감</span>}
      {countdown !== null && <span className="text-ink-soft">제한시간까지 {formatCountdown(countdown)}</span>}
      <span className="text-mute text-xs">모두 마감하거나 제한시간이 지나면 함께 다음 분기로 넘어갑니다.</span>
    </div>
  )
}
