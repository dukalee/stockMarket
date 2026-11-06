export const STARTING_CASH = 10_000_000
export const MAX_HISTORY_POINTS = 300
export const INTRA_QUARTER_VOL_FACTOR = 0.2
export const QUARTERS_PER_YEAR = 4
export const NEWS_PER_QUARTER_MIN = 5
export const NEWS_PER_QUARTER_MAX = 7
export const PRICE_TICK_MS = 1_000

/** 시뮬레이션 모드(대회 코드 없음)에서 진행하는 분기 수 */
export const SIMULATION_QUARTERS = 4
/** 대회 모드 기본값 — 대회마다 서버 설정(round_seconds, penalty_rate)으로 바뀔 수 있다 */
export const CONTEST_ROUND_SECONDS = 300      // 한 라운드(분기) 제한시간 5분
export const CONTEST_PENALTY_RATE  = 0.25     // 시간 초과 페널티: 현금과 보유 주식의 25%
/** 분기 사이 휴식(순위 팝업이 뜨는 시간). 서버 `_close_rounds`의 v_break 와 같은 값이어야 한다 */
export const ROUND_BREAK_MS = 10_000
/** 대회 최대 분기 수. 서버 contests.quarters 의 check 와 같은 값이어야 한다 */
export const MAX_CONTEST_QUARTERS = 12
