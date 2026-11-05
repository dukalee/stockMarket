import { supabase } from '../lib/supabase'
import type { ContestInfo } from '../stores/gameStore'

/** 기기마다 한 번 만들어 브라우저에 저장하는 토큰. 같은 이름의 본인 기록만 갱신할 수 있게 한다. */
const TOKEN_KEY = 'shiftstocks-device-token'
const sessionToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : String(Math.random()).slice(2) + String(Date.now())

export function getDeviceToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      t = crypto.randomUUID()
      localStorage.setItem(TOKEN_KEY, t)
    }
    return t
  } catch {
    // 저장소를 쓸 수 없는 환경: 이 세션 동안만 유효한 토큰
    return sessionToken
  }
}

export type ContestStatus = 'lobby' | 'running' | 'finished'

export interface JoinResult {
  contest: ContestInfo
  status: ContestStatus
  resumed: boolean         // 같은 기기로 이미 참가한 기록이 있다
  quarter: number          // 서버에 기록된 마감 분기 수
  finished: boolean
  serverTimeMs: number
}

/** 서버가 관리하는 현재 라운드 상태 — 몇 초마다 가져온다 */
export interface RoundState {
  status: ContestStatus
  currentRound: number           // 0 = 대기실, 1..quarters = 진행 중, quarters+1 = 종료
  quarters: number
  roundSeconds: number
  roundStartedAt: number | null  // 현재 라운드가 시작된 시각 (서버 기준 ms)
  serverTime: number
  totalPlayers: number
  donePlayers: number            // 이번 라운드를 마감한 참가자 수
  myRoundDone: number
  myPenaltyRounds: number[]      // 내가 마감하지 못해 페널티를 받은 라운드들
  players: string[]              // 대기실 참가자 이름 (대회가 시작되면 비어 있음)
}

export interface LeaderboardRow {
  nickname: string
  quarter: number
  total_assets: number | null
  return_pct: number | null
  finished: boolean
  updated_at: string
  round_done: number
}

export interface LeaderboardData {
  contest: {
    code: string
    title: string
    quarters: number
    initial_capital: number
    is_open: boolean
    status: ContestStatus
    current_round: number
    round_seconds: number
  }
  players: LeaderboardRow[]
}

const ERROR_MESSAGES: Record<string, string> = {
  contest_not_found:   '존재하지 않는 대회 코드입니다. 코드를 다시 확인해 주세요.',
  contest_not_started: '아직 참가를 받지 않는 대회입니다.',
  contest_closed:      '참가 기간이 끝난 대회입니다.',
  contest_started:     '이미 시작된 대회라서 새로 참가할 수 없습니다.',
  nickname_taken:      '이미 이 대회에서 사용 중인 이름입니다. 다른 이름을 입력해 주세요.',
  invalid_nickname:    '이름은 1~12자로 입력해 주세요.',
  invalid_token:       '이 기기에서는 대회에 참가할 수 없습니다.',
  not_allowed:         '이 기기의 참가 기록이 아닙니다.',
  invalid_quarter:     '분기 기록이 올바르지 않습니다.',
  invalid_score:       '점수 기록이 올바르지 않습니다.',
  round_mismatch:      '라운드가 이미 바뀌었습니다. 잠시 후 자동으로 이어집니다.',
  wrong_host_key:      '진행자 키가 올바르지 않습니다.',
  already_started:     '이미 시작된 대회입니다.',
  no_players:          '참가자가 없어 시작할 수 없습니다.',
  not_running:         '진행 중인 대회가 아닙니다.',
}

export class ContestError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function toError(err: { message?: string } | null): ContestError {
  const raw = err?.message ?? ''
  const key = Object.keys(ERROR_MESSAGES).find(k => raw.includes(k))
  if (key) return new ContestError(key, ERROR_MESSAGES[key])
  return new ContestError('network', '대회 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
}

function requireClient() {
  if (!supabase) throw new ContestError('not_configured', '대회 서버가 설정되지 않았습니다. 대회 코드 없이 시뮬레이션으로 시작해 주세요.')
  return supabase
}

/** 대회 코드와 이름으로 대기실에 입장한다. 유효하고 참가 가능할 때만 시드와 설정을 받는다. */
export async function joinContest(code: string, nickname: string): Promise<JoinResult> {
  const client = requireClient()
  const { data, error } = await client.rpc('join_contest', {
    p_code: code.trim(),
    p_nickname: nickname.trim(),
    p_token: getDeviceToken(),
  })
  if (error) throw toError(error)

  return {
    contest: {
      code: data.code,
      title: data.title,
      seed: data.seed,
      quarters: data.quarters,
      initialCapital: Number(data.initial_capital),
      roundSeconds: data.round_seconds,
      penaltyRate: Number(data.penalty_rate),
    },
    status: data.status,
    resumed: !!data.resumed,
    quarter: data.quarter,
    finished: !!data.finished,
    serverTimeMs: Number(data.server_time),
  }
}

/** 현재 라운드 상태. 서버는 이 호출 때 "다음 분기로 넘길 때가 됐는지"도 계산한다. */
export async function getRoundState(code: string, nickname: string): Promise<RoundState> {
  const client = requireClient()
  const { data, error } = await client.rpc('get_round_state', {
    p_code: code,
    p_nickname: nickname,
    p_token: getDeviceToken(),
  })
  if (error) throw toError(error)
  return {
    status: data.status,
    currentRound: data.current_round,
    quarters: data.quarters,
    roundSeconds: data.round_seconds,
    roundStartedAt: data.round_started_at === null ? null : Number(data.round_started_at),
    serverTime: Number(data.server_time),
    totalPlayers: data.total_players,
    donePlayers: data.done_players,
    myRoundDone: data.my_round_done,
    myPenaltyRounds: data.my_penalty_rounds ?? [],
    players: data.players ?? [],
  }
}

/** 이번 라운드 마감 — "투자를 마쳤다"고 서버에 알린다. 전원이 마감하면 모두 다음 분기로 넘어간다. */
export async function finishRound(code: string, nickname: string, round: number): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('finish_round', {
    p_code: code,
    p_nickname: nickname,
    p_token: getDeviceToken(),
    p_round: round,
  })
  if (error) throw toError(error)
}

/** 분기가 넘어가 가격이 바뀐 뒤 내 점수를 올린다. quarter 는 마감한 분기 수. */
export async function submitScore(p: {
  code: string
  nickname: string
  quarter: number
  totalAssets: number
  finished: boolean
}): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('submit_score', {
    p_code: p.code,
    p_nickname: p.nickname,
    p_token: getDeviceToken(),
    p_quarter: p.quarter,
    p_total_assets: Math.round(p.totalAssets),
    p_finished: p.finished,
  })
  if (error) throw toError(error)
}

export async function fetchLeaderboard(code: string): Promise<LeaderboardData> {
  const client = requireClient()
  const { data, error } = await client.rpc('get_leaderboard', { p_code: code.trim() })
  if (error) throw toError(error)
  return data as LeaderboardData
}

/** 진행자: 대기실을 닫고 모두 동시에 1분기를 시작한다. */
export async function hostStartContest(code: string, hostKey: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('host_start_contest', { p_code: code.trim(), p_host_key: hostKey })
  if (error) throw toError(error)
}

/** 진행자: 지금 라운드를 바로 닫고 다음 분기로 넘긴다. */
export async function hostForceNext(code: string, hostKey: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('host_force_next', { p_code: code.trim(), p_host_key: hostKey })
  if (error) throw toError(error)
}
