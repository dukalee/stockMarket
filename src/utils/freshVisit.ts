/**
 * 앱을 나갔다 다시 오면(탭·브라우저를 닫았다가 새로 열면) 저장된 게임을 비운다.
 *
 * - 새로고침은 같은 탭이라 sessionStorage 가 남아 있으므로 "나갔다 온 것"이 아니다 → 저장분을 그대로 이어서 쓴다.
 * - 탭을 닫으면 sessionStorage 가 사라지므로, 다음에 열 때 "새 방문"으로 판단한다.
 * - 새 방문일 때 비우는 것: 연습(시뮬레이션) 게임, 끝난 대회, 시작하지 않은 저장분 → 게임·포트폴리오·시장 저장분.
 * - 새 방문이어도 **진행 중인 대회**(대기실·진행 중)는 비우지 않는다 — 대회는 닫았다 열어도 이어서 해야 한다.
 * - 대회 참가 토큰(shiftstocks-device-token)과 서버에 못 보낸 포기 기록(shiftstocks-pending-forfeit)은 항상 남긴다.
 *
 * zustand persist 스토어가 만들어지기 전에 실행돼야 하므로 main.tsx 에서 가장 먼저 import 한다.
 */
const SESSION_MARK = 'shiftstocks-session'
const GAME_KEYS = ['shiftstocks-game', 'shiftstocks-portfolio', 'shiftstocks-market']

try {
  if (!sessionStorage.getItem(SESSION_MARK)) {
    sessionStorage.setItem(SESSION_MARK, '1')

    let keep = false
    try {
      const s = JSON.parse(localStorage.getItem('shiftstocks-game') ?? 'null')?.state
      keep = s?.mode === 'contest' && (s?.phase === 'lobby' || s?.phase === 'playing' || s?.phase === 'advancing')
    } catch { /* 저장분을 읽을 수 없으면 비운다 */ }

    if (!keep) for (const k of GAME_KEYS) localStorage.removeItem(k)
  }
} catch { /* 저장소를 쓸 수 없는 환경(시크릿 모드 등)에서는 아무것도 하지 않는다 */ }

export {}
