import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GamePhase, GameMode } from '../types'
import { SIMULATION_QUARTERS, CONTEST_ROUND_SECONDS, CONTEST_PENALTY_RATE } from '../utils/constants'

export interface QuarterResult {
  endingYear: number
  endingQuarter: number
  newYear: number
  newQuarter: number
  changes: Record<string, number>
}

/** 대회 모드 설정 — 서버(join_contest)에서 받아 온다 */
export interface ContestInfo {
  code: string
  title: string
  seed: string            // 서버가 가진 비밀 시드. 코드만으로는 알 수 없다.
  quarters: number
  initialCapital: number
  roundSeconds: number
  penaltyRate: number
}

/** 시간 초과 페널티 기록 */
export interface PenaltyRecord {
  qIndex: number
  cashLoss: number
  stockLosses: { stockId: string; shares: number }[]
}

interface GameState {
  userName: string
  initialCapital: number
  currentYear: number
  currentQuarter: number
  phase: GamePhase
  adminAuth: boolean
  quarterResult: QuarterResult | null

  mode: GameMode
  contest: ContestInfo | null
  totalQuarters: number
  clockOffsetMs: number               // 서버 시각 - 기기 시각 (기기 시계 조작 완화)
  quarterStartedAt: number | null     // 이번 분기(라운드)가 시작된 시각 (서버 기준 ms)
  roundSubmitted: number              // 대회: 내가 마감한 마지막 분기 번호 (0 = 아직 없음)
  penalties: PenaltyRecord[]
  timeoutNotice: PenaltyRecord | null // 방금 받은 페널티 안내 (모달용)
  scoreSyncError: string | null       // 리더보드 점수 전송 실패 메시지
  advanceError: string | null         // 분기 진행 중 오류 메시지
  showFinalResult: boolean            // 최종 결과 팝업 표시 여부

  /** 시뮬레이션 모드 시작 */
  startGame: (p: { userName: string; initialCapital: number; mode: GameMode }) => void
  /** 대회 모드: 대기실에 입장 (아직 게임은 시작되지 않았다) */
  enterLobby: (p: { userName: string; contest: ContestInfo; clockOffsetMs: number }) => void
  /** 대회 모드: 진행자가 시작해서 1분기가 열렸다 */
  beginContest: () => void
  setPhase: (phase: GamePhase) => void
  nextQuarter: () => void
  setAdminAuth: (auth: boolean) => void
  setQuarterResult: (result: QuarterResult) => void
  clearQuarterResult: () => void
  setClockOffset: (ms: number) => void
  startRoundTimer: (serverStartMs?: number) => void
  markRoundSubmitted: (qIndex: number) => void
  recordPenalty: (record: PenaltyRecord) => void
  clearTimeoutNotice: () => void
  setScoreSyncError: (msg: string | null) => void
  setAdvanceError: (msg: string | null) => void
  openFinalResult: () => void
  closeFinalResult: () => void
  finishGame: () => void
  resetGame: () => void
  isReady: () => boolean
}

const initial = {
  userName: '',
  initialCapital: 0,
  currentYear: 1,
  currentQuarter: 1,
  phase: 'setup' as GamePhase,
  adminAuth: false,
  quarterResult: null as QuarterResult | null,
  mode: 'simulation' as GameMode,
  contest: null as ContestInfo | null,
  totalQuarters: SIMULATION_QUARTERS,
  clockOffsetMs: 0,
  quarterStartedAt: null as number | null,
  roundSubmitted: 0,
  penalties: [] as PenaltyRecord[],
  timeoutNotice: null as PenaltyRecord | null,
  scoreSyncError: null as string | null,
  advanceError: null as string | null,
  showFinalResult: false,
}

/** 게임 전체 기준 분기 번호 (1부터) */
export const quarterIndexOf = (year: number, quarter: number) => (year - 1) * 4 + quarter

/** 대회 모드의 제한시간·페널티 설정 */
export const roundSecondsOf = (c: ContestInfo | null) => c?.roundSeconds ?? CONTEST_ROUND_SECONDS
export const penaltyRateOf  = (c: ContestInfo | null) => c?.penaltyRate ?? CONTEST_PENALTY_RATE

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,

      startGame: ({ userName, initialCapital, mode }) =>
        set({
          ...initial,
          adminAuth: get().adminAuth,
          userName, initialCapital, mode,
          phase: 'playing',
        }),

      enterLobby: ({ userName, contest, clockOffsetMs }) =>
        set({
          ...initial,
          adminAuth: get().adminAuth,
          userName,
          initialCapital: contest.initialCapital,
          mode: 'contest',
          contest,
          totalQuarters: contest.quarters,
          clockOffsetMs,
          phase: 'lobby',
        }),

      beginContest: () => set({
        phase: 'playing',
        currentYear: 1,
        currentQuarter: 1,
        roundSubmitted: 0,
        penalties: [],
        timeoutNotice: null,
        showFinalResult: false,
      }),

      setPhase: (phase) => set({ phase }),

      nextQuarter: () => set(state => {
        if (state.currentQuarter < 4) return { currentQuarter: state.currentQuarter + 1 }
        return { currentYear: state.currentYear + 1, currentQuarter: 1 }
      }),

      setAdminAuth: (adminAuth) => set({ adminAuth }),
      setQuarterResult: (result) => set({ quarterResult: result }),
      clearQuarterResult: () => set({ quarterResult: null }),

      setClockOffset: (clockOffsetMs) => set({ clockOffsetMs }),

      // 새 분기가 시작될 때 호출한다. 대회 모드는 서버가 알려 준 라운드 시작 시각을 그대로 쓴다.
      startRoundTimer: (serverStartMs) => set(state => ({
        quarterStartedAt: serverStartMs ?? Date.now() + state.clockOffsetMs,
      })),

      markRoundSubmitted: (roundSubmitted) => set({ roundSubmitted }),

      recordPenalty: (record) => set(state => ({
        penalties: [...state.penalties, record],
        timeoutNotice: record,
      })),
      clearTimeoutNotice: () => set({ timeoutNotice: null }),
      setScoreSyncError: (scoreSyncError) => set({ scoreSyncError }),
      setAdvanceError: (advanceError) => set({ advanceError }),
      openFinalResult: () => set({ showFinalResult: true }),
      closeFinalResult: () => set({ showFinalResult: false }),

      // 대회는 마지막 분기가 끝나도 결과를 자동으로 띄우지 않는다 — NavBar 의 "최종 결과 보기"를 눌러야 전체 순위 화면으로 간다
      finishGame: () => set({ phase: 'finished', quarterStartedAt: null, showFinalResult: get().mode !== 'contest' }),
      resetGame: () => set({ ...initial, adminAuth: get().adminAuth }),

      isReady: () => get().phase !== 'setup',
    }),
    {
      name: 'shiftstocks-game',
      version: 2,
      // 새로고침해도 진행이 이어지도록 저장한다. 관리자 로그인과 일회성 팝업·오류는 저장하지 않는다.
      partialize: (s) => ({
        userName: s.userName,
        initialCapital: s.initialCapital,
        currentYear: s.currentYear,
        currentQuarter: s.currentQuarter,
        phase: s.phase === 'advancing' ? 'playing' : s.phase,
        mode: s.mode,
        contest: s.contest,
        totalQuarters: s.totalQuarters,
        clockOffsetMs: s.clockOffsetMs,
        quarterStartedAt: s.quarterStartedAt,
        roundSubmitted: s.roundSubmitted,
        penalties: s.penalties,
      }),
      // 이전 버전에 저장된 값은 버린다 (필드 구성이 바뀌었다)
      migrate: () => ({}) as never,
    },
  ),
)
