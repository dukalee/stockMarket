import { forfeitContest, ContestError } from './contest'

/**
 * 대회 포기 — 서버에 연결할 수 없어도 포기는 된다.
 *
 * 포기는 먼저 서버에 보내 보고, 연결이 안 되면 이 기기에 "보내지 못한 포기"로 저장해 둔다.
 * 저장된 포기는 연결이 돌아오면(앱이 켜질 때, 인터넷이 다시 연결될 때, 몇 초마다) 자동으로 서버에 다시 보낸다.
 * 서버는 같은 포기를 여러 번 받아도 한 번만 처리하므로 다시 보내도 안전하다.
 *
 * 서버가 분명하게 거절한 경우(이미 끝난 대회 등)는 다시 보내지 않고 버린다 — 서버가 받아 주지 않는 포기이기 때문이다.
 */
const KEY = 'shiftstocks-pending-forfeit'
const SEND_TIMEOUT_MS = 8_000   // 연결이 멈춰 있어도 이만큼만 기다리고 포기를 진행한다

export interface PendingForfeit {
  code: string
  nickname: string
  totalAssets: number   // 포기한 시점의 총 자산 (최종 기록이 된다)
  quarter: number       // 포기한 분기
  at: number
}

// ── 저장소: 값이 바뀔 때만 새 배열을 만들어 화면(useSyncExternalStore)이 불필요하게 다시 그려지지 않게 한다 ──
const listeners = new Set<() => void>()

function readStored(): PendingForfeit[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

let snapshot: PendingForfeit[] = readStored()

function write(next: PendingForfeit[]) {
  snapshot = next
  try {
    if (next.length > 0) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch { /* 저장이 막힌 환경에서는 이 화면을 닫기 전까지만 기억한다 */ }
  listeners.forEach(l => l())
}

export const subscribePendingForfeits = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getPendingForfeits = () => snapshot

const same = (a: { code: string; nickname: string }, b: { code: string; nickname: string }) =>
  a.code.trim().toUpperCase() === b.code.trim().toUpperCase() && a.nickname.trim() === b.nickname.trim()

/** 이 이름으로 이 대회에서 포기했지만 아직 서버에 전해지지 않았는가 */
export function isForfeitPending(code: string, nickname: string): boolean {
  return snapshot.some(p => same(p, { code, nickname }))
}

function queue(entry: PendingForfeit) {
  write([...snapshot.filter(p => !same(p, entry)), entry])
}

// 연결이 멈춰 있어도 영원히 기다리지 않도록 한다
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new ContestError('network', '대회 서버 응답이 없습니다.')), ms)
    p.then(v => { window.clearTimeout(id); resolve(v) }, e => { window.clearTimeout(id); reject(e) })
  })
}

const isConnectionProblem = (err: unknown) => err instanceof ContestError && err.code === 'network'

/**
 * 포기를 서버에 보낸다. 어떤 경우에도 던지지 않는다 — 호출한 쪽은 결과와 상관없이 대회를 떠나면 된다.
 *   done     서버에 기록됐다 (이미 포기한 상태였어도 포함)
 *   queued   연결할 수 없어 이 기기에 저장했다. 연결되면 자동으로 보낸다.
 *   rejected 서버가 분명하게 거절했다 (이미 끝난 대회 등). 다시 보내지 않는다.
 */
export async function forfeitWithFallback(entry: Omit<PendingForfeit, 'at'>): Promise<'done' | 'queued' | 'rejected'> {
  try {
    await withTimeout(forfeitContest(entry.code, entry.nickname, entry.totalAssets), SEND_TIMEOUT_MS)
    return 'done'
  } catch (err) {
    if (isConnectionProblem(err)) {
      queue({ ...entry, at: Date.now() })
      return 'queued'
    }
    return 'rejected'
  }
}

let flushing = false

/** 저장된 포기를 서버에 다시 보낸다. 아직 보내지 못한 개수를 돌려준다. */
export async function flushPendingForfeits(): Promise<number> {
  if (flushing || snapshot.length === 0) return snapshot.length
  flushing = true
  try {
    for (const entry of [...snapshot]) {
      try {
        await withTimeout(forfeitContest(entry.code, entry.nickname, entry.totalAssets), SEND_TIMEOUT_MS)
        write(snapshot.filter(p => !same(p, entry)))
      } catch (err) {
        if (isConnectionProblem(err)) break                       // 아직 연결이 안 된다 — 나머지도 다음에 보낸다
        write(snapshot.filter(p => !same(p, entry)))              // 서버가 거절했다 — 더 보내도 소용없다
      }
    }
  } finally {
    flushing = false
  }
  return snapshot.length
}
