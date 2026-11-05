export const STARTING_CASH = 10_000_000
export const MAX_HISTORY_POINTS = 300
export const INTRA_QUARTER_VOL_FACTOR = 0.2
export const QUARTERS_PER_YEAR = 4
export const NEWS_PER_QUARTER_MIN = 5
export const NEWS_PER_QUARTER_MAX = 7
export const PRICE_TICK_MS = 1_000
export const ADMIN_PASSWORD = 'rootroot'

/** 시뮬레이션 모드(대회 코드 없음)에서 진행하는 분기 수 */
export const SIMULATION_QUARTERS = 4
/** 대회 모드 기본값 — 대회마다 서버 설정(round_seconds, penalty_rate)으로 바뀔 수 있다 */
export const CONTEST_ROUND_SECONDS = 300      // 한 라운드(분기) 제한시간 5분
export const CONTEST_PENALTY_RATE  = 0.25     // 시간 초과 페널티: 현금과 보유 주식의 25%
