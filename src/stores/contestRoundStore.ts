import { create } from 'zustand'
import type { RoundState } from '../services/contest'

/** 서버에서 가져온 현재 라운드 상태 (저장하지 않는다 — 새로고침하면 다시 가져온다) */
interface ContestRoundStore {
  state: RoundState | null
  error: string | null
  setState: (s: RoundState) => void
  setError: (e: string | null) => void
  clear: () => void
}

export const useContestRoundStore = create<ContestRoundStore>((set) => ({
  state: null,
  error: null,
  setState: (state) => set({ state, error: null }),
  setError: (error) => set({ error }),
  clear: () => set({ state: null, error: null }),
}))
