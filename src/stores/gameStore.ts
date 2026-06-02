import { create } from 'zustand'
import type { GamePhase } from '../types'

export interface QuarterResult {
  endingYear: number
  endingQuarter: number
  newYear: number
  newQuarter: number
  changes: Record<string, number>
}

interface GameState {
  userName: string
  apiKey: string
  initialCapital: number
  currentYear: number
  currentQuarter: number
  phase: GamePhase
  adminAuth: boolean
  quarterResult: QuarterResult | null

  startGame: (userName: string, apiKey: string, initialCapital: number) => void
  setPhase: (phase: GamePhase) => void
  nextQuarter: () => void
  setAdminAuth: (auth: boolean) => void
  setQuarterResult: (result: QuarterResult) => void
  clearQuarterResult: () => void
  isReady: () => boolean
}

export const useGameStore = create<GameState>((set, get) => ({
  userName: '',
  apiKey: '',
  initialCapital: 0,
  currentYear: 1,
  currentQuarter: 1,
  phase: 'setup',
  adminAuth: false,
  quarterResult: null,

  startGame: (userName, apiKey, initialCapital) =>
    set({ userName, apiKey, initialCapital, phase: 'playing', currentYear: 1, currentQuarter: 1 }),

  setPhase: (phase) => set({ phase }),

  nextQuarter: () => set(state => {
    if (state.currentQuarter < 4) return { currentQuarter: state.currentQuarter + 1 }
    return { currentYear: state.currentYear + 1, currentQuarter: 1 }
  }),

  setAdminAuth: (adminAuth) => set({ adminAuth }),
  setQuarterResult: (result) => set({ quarterResult: result }),
  clearQuarterResult: () => set({ quarterResult: null }),

  isReady: () => !!get().apiKey,
}))
