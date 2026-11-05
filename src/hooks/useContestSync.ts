import { useEffect } from 'react'
import { useGameStore, quarterIndexOf } from '../stores/gameStore'
import { useContestRoundStore } from '../stores/contestRoundStore'
import { getRoundState } from '../services/contest'
import { advanceQuarter, beginContestGame } from '../services/quarterAdvance'

const POLL_MS = 2500   // 몇 초마다 서버에서 라운드 상태를 가져온다

/**
 * 대회 모드 동기화 — App 에서 한 번만 호출한다.
 *  1. 몇 초마다 서버의 현재 라운드 상태를 가져온다. (서버는 이때 "다음 분기로 넘길 때인지"도 계산한다)
 *  2. 대기실에서 진행자가 대회를 시작했으면 1분기를 연다.
 *  3. 서버가 나보다 앞선 라운드에 있으면(전원 마감 또는 제한시간 초과) 내 분기를 마감하고 따라간다.
 *     — 내가 마감하지 못해 서버가 페널티를 표시했다면 이때 함께 적용된다.
 */
export function useContestSync() {
  const mode     = useGameStore(s => s.mode)
  const phase    = useGameStore(s => s.phase)
  const contest  = useGameStore(s => s.contest)
  const userName = useGameStore(s => s.userName)
  const qIndex   = useGameStore(s => quarterIndexOf(s.currentYear, s.currentQuarter))
  const state    = useContestRoundStore(s => s.state)

  const active = mode === 'contest' && !!contest && (phase === 'lobby' || phase === 'playing' || phase === 'advancing')
  const code = contest?.code

  // 서버 상태 가져오기
  useEffect(() => {
    if (!active || !code) return
    let cancelled = false
    const tick = async () => {
      try {
        const rs = await getRoundState(code, userName)
        if (cancelled) return
        useContestRoundStore.getState().setState(rs)
        useGameStore.getState().setClockOffset(rs.serverTime - Date.now())
      } catch (err) {
        if (!cancelled) useContestRoundStore.getState().setError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.')
      }
    }
    void tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [active, code, userName])

  // 서버 상태에 맞춰 게임을 움직인다
  useEffect(() => {
    if (!state || mode !== 'contest') return
    if (phase === 'lobby' && state.status !== 'lobby') {
      void beginContestGame()
    } else if (phase === 'playing' && qIndex < state.currentRound) {
      void advanceQuarter()
    }
  }, [state, phase, qIndex, mode])
}
