/**
 * 관리자 키 보관 — 이 브라우저 탭에서만 기억한다 (sessionStorage).
 * 탭을 닫으면 사라지고 디스크에는 저장하지 않는다. 저장이 막힌 환경에서는 조용히 무시한다.
 */
const KEY_STORAGE = 'shiftstocks-admin-key'

export function loadAdminKey(): string {
  try { return sessionStorage.getItem(KEY_STORAGE) ?? '' } catch { return '' }
}

export function saveAdminKey(key: string): void {
  try {
    if (key) sessionStorage.setItem(KEY_STORAGE, key)
    else sessionStorage.removeItem(KEY_STORAGE)
  } catch { /* 저장 불가 시 이 화면에서만 유지 */ }
}
