/**
 * 시드 기반 난수. 같은 시드 문자열이면 언제 어디서 실행해도 같은 수열이 나온다.
 * 대회 모드에서 모든 참가자가 같은 기사·등락·시작가를 받도록 하는 데 쓴다.
 */

export interface Rng {
  /** 0 이상 1 미만 */
  next: () => number
  /** [lo, hi) 실수 */
  range: (lo: number, hi: number) => number
  /** 0 ~ n-1 정수 */
  int: (n: number) => number
  /** 배열에서 하나 */
  pick: <T>(arr: T[]) => T
  /** 새 배열로 섞기 */
  shuffle: <T>(arr: T[]) => T[]
}

// 문자열 → 32비트 해시 (xmur3)
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

// mulberry32
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(next: () => number): Rng {
  const int = (n: number) => Math.floor(next() * n)
  return {
    next,
    range: (lo, hi) => next() * (hi - lo) + lo,
    int,
    pick: arr => arr[int(arr.length)],
    shuffle: arr => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(i + 1)
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    },
  }
}

/** 시드 문자열로 난수 생성기를 만든다. */
export function createRng(seed: string): Rng {
  return build(mulberry32(hashSeed(seed)))
}

/** 시드 없이 쓰는 일반 난수 (시뮬레이션 모드) */
export const randomRng: Rng = build(Math.random)
