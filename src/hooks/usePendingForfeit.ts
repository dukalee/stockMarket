import { useEffect, useSyncExternalStore } from 'react'
import { flushPendingForfeits, getPendingForfeits, subscribePendingForfeits } from '../services/pendingForfeit'

const RETRY_MS = 15_000   // 보내지 못한 포기가 있으면 이 간격으로 다시 보낸다

/** 이 기기에 저장된, 아직 서버에 전해지지 않은 대회 포기 목록 */
export function usePendingForfeits() {
  return useSyncExternalStore(subscribePendingForfeits, getPendingForfeits, getPendingForfeits)
}

/**
 * App 에서 한 번만 호출한다.
 * 앱이 켜질 때, 인터넷이 다시 연결될 때, 그리고 보내지 못한 포기가 남아 있는 동안 몇 초마다 서버에 다시 보낸다.
 */
export function usePendingForfeitSync() {
  const pending = usePendingForfeits()
  const hasPending = pending.length > 0

  useEffect(() => {
    void flushPendingForfeits()
    const onOnline = () => { void flushPendingForfeits() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    if (!hasPending) return
    const id = window.setInterval(() => { void flushPendingForfeits() }, RETRY_MS)
    return () => window.clearInterval(id)
  }, [hasPending])
}
