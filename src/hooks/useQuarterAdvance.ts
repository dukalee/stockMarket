import { useGameStore } from '../stores/gameStore'
import { advanceQuarter, markRoundDone } from '../services/quarterAdvance'

/**
 * "다음 분기로" 버튼이 쓰는 훅.
 *  - 시뮬레이션: 바로 다음 분기로 넘어간다.
 *  - 대회: 이번 분기를 "마감"만 한다. 실제로 분기가 넘어가는 것은 전원이 마감하거나
 *    제한시간이 지났을 때 서버가 알려 주면 useContestSync 가 처리한다.
 */
export function useQuarterAdvance() {
  const phase        = useGameStore(s => s.phase)
  const advanceError = useGameStore(s => s.advanceError)

  const advance = async () => {
    const g = useGameStore.getState()
    if (g.phase !== 'playing') return
    if (g.mode === 'contest') await markRoundDone()
    else await advanceQuarter()
  }

  return { advance, isAdvancing: phase === 'advancing', advanceError }
}
