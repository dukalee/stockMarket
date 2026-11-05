import { create } from 'zustand'
import type { Stock } from '../types'

/**
 * 타이틀 화면 전용 "라이브" 시세 — 오늘의 주가표와 오늘의 차트가 같은 데이터를 본다.
 * 게임 상태(marketStore)와는 완전히 분리돼 있어 실제 게임 가격에 영향을 주지 않는다.
 */

export interface LiveCandle { open: number; close: number; high: number; low: number }
export interface LivePrice  { price: number; tick: number; dir: 'up' | 'down' | null }

const BOARD_ROWS   = 8     // 주가표에 보이는 종목 수
export const CANDLES = 34  // 차트에 보이는 캔들 수
const FOCUS_EVERY  = 7     // 이 횟수만큼 갱신되면 차트 종목이 다음 종목으로 바뀐다
const MOVES_PER_TICK = 3   // 한 번에 가격이 바뀌는 종목 수 (차트 종목은 항상 포함)

const rand  = (lo: number, hi: number) => Math.random() * (hi - lo) + lo
const gauss = () => rand(-1, 1) + rand(-1, 1) + rand(-1, 1)
const roundWon = (n: number) => Math.max(100, Math.round(n / 100) * 100)

function makeCandle(open: number, close: number, base: number): LiveCandle {
  const wick = base * 0.005
  return {
    open, close,
    high: Math.max(open, close) + Math.random() * wick,
    low:  Math.max(100, Math.min(open, close) - Math.random() * wick),
  }
}

/** 마지막 종가가 정확히 현재가가 되도록 만든 과거 캔들들 */
function makeHistory(base: number): LiveCandle[] {
  const raw: LiveCandle[] = []
  let p = base * (1 + rand(-0.04, 0.04))
  for (let i = 0; i < CANDLES; i++) {
    const open  = p
    const close = Math.max(100, open + (base - open) * 0.04 + gauss() * base * 0.011)
    raw.push(makeCandle(open, close, base))
    p = close
  }
  const k = base / raw[raw.length - 1].close
  return raw.map(c => ({ open: c.open * k, close: c.close * k, high: c.high * k, low: c.low * k }))
}

interface TitleLiveState {
  ids:     string[]
  base:    Record<string, number>
  live:    Record<string, LivePrice>
  history: Record<string, LiveCandle[]>
  focusId: string | null
  ticks:   number
  init: (stocks: Stock[]) => void
  tick: () => void
}

export const useTitleLiveStore = create<TitleLiveState>((set) => ({
  ids: [], base: {}, live: {}, history: {}, focusId: null, ticks: 0,

  init: (stocks) => {
    const rows = stocks.slice(0, BOARD_ROWS)
    set({
      ids:  rows.map(s => s.id),
      base: Object.fromEntries(rows.map(s => [s.id, s.currentPrice])),
      live: Object.fromEntries(rows.map(s => [s.id, { price: s.currentPrice, tick: 0, dir: null }])),
      history: Object.fromEntries(rows.map(s => [s.id, makeHistory(s.currentPrice)])),
      focusId: rows[0]?.id ?? null,
      ticks: 0,
    })
  },

  tick: () => set(state => {
    if (!state.ids.length || !state.focusId) return state

    const others = state.ids.filter(id => id !== state.focusId).sort(() => Math.random() - 0.5)
    const moving = [state.focusId, ...others.slice(0, MOVES_PER_TICK - 1)]

    const live    = { ...state.live }
    const history = { ...state.history }

    for (const id of moving) {
      const cur  = state.live[id]
      const base = state.base[id]
      let price = roundWon(Math.min(base * 1.12, Math.max(base * 0.88, cur.price * (1 + rand(-0.018, 0.018)))))
      if (price === cur.price) price = roundWon(cur.price + (Math.random() < 0.5 ? -100 : 100) * Math.max(1, Math.round(base / 50_000)))
      live[id]    = { price, tick: cur.tick + 1, dir: price > cur.price ? 'up' : 'down' }
      history[id] = [...state.history[id].slice(1), makeCandle(cur.price, price, base)]
    }

    const ticks = state.ticks + 1
    let focusId = state.focusId
    if (ticks % FOCUS_EVERY === 0) {
      focusId = state.ids[(state.ids.indexOf(state.focusId) + 1) % state.ids.length]
    }
    return { live, history, ticks, focusId }
  }),
}))
