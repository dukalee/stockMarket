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
  quarter_returns: (number | null)[]   // 분기 마감 시점의 누적 수익률(%). 인덱스 0 = 1분기, 아직 없는 분기는 null
  forfeited_quarter: number | null     // 대회를 포기한 분기 번호 (포기하지 않았으면 null). 총 자산·수익률은 포기한 시점의 값
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
  wrong_admin_key:     '관리자 키가 올바르지 않습니다.',
  admin_not_configured:'서버에 관리자 키가 등록되지 않았습니다. schema.sql 아래쪽의 "관리자 키 등록"을 먼저 실행해 주세요.',
  invalid_settings:    '분기 수(1~12), 제한시간(30~3600초), 페널티(0~100%) 범위를 확인해 주세요.',
  round_not_started:   '다음 분기가 아직 시작되지 않았습니다. 잠시 후 다시 시도해 주세요.',
  invalid_code:        '대회 코드는 영문 대문자·숫자·-·_ 로 3~20자여야 합니다.',
  code_taken:          '이미 사용 중인 대회 코드입니다. 다른 코드를 쓰거나 비워 두세요.',
  not_finished:        '종료된 대회만 삭제할 수 있습니다.',
  forfeited:           '이미 포기한 대회입니다. 다시 참가할 수 없습니다.',
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

/**
 * 진행 중인 대회를 포기한다. 포기한 시점의 총 자산이 최종 기록이 되고, 포기한 분기가 함께 남는다.
 * 서버는 포기한 참가자를 "모든 분기를 마감한 사람"으로 세므로 다른 참가자는 기다리지 않는다. 한 번 포기하면 다시 들어올 수 없다.
 */
export async function forfeitContest(code: string, nickname: string, totalAssets: number): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc('forfeit_contest', {
    p_code: code.trim(),
    p_nickname: nickname.trim(),
    p_token: getDeviceToken(),
    p_total_assets: Math.round(totalAssets),
  })
  if (error) throw toError(error)
}

export async function fetchLeaderboard(code: string): Promise<LeaderboardData> {
  const client = requireClient()
  const { data, error } = await client.rpc('get_leaderboard', { p_code: code.trim() })
  if (error) throw toError(error)
  return data as LeaderboardData
}

export interface CreatedContest {
  code: string
  title: string
  hostKey: string
  quarters: number
  roundSeconds: number
  penaltyRate: number
}

/** 관리자: 서버가 관리자 키를 확인한 뒤 대회를 만든다. code 를 비우면 서버가 자동으로 정한다. */
export async function createContest(adminKey: string, opts: {
  title: string
  code: string
  quarters: number
  roundSeconds: number
  penaltyRate: number
}): Promise<CreatedContest> {
  const client = requireClient()
  const { data, error } = await client.rpc('create_contest', {
    p_admin_key: adminKey,
    p_title: opts.title,
    p_code: opts.code,
    p_quarters: opts.quarters,
    p_round_seconds: opts.roundSeconds,
    p_penalty_rate: opts.penaltyRate,
  })
  if (error) throw toError(error)
  return {
    code: data.code,
    title: data.title,
    hostKey: data.host_key,
    quarters: data.quarters,
    roundSeconds: data.round_seconds,
    penaltyRate: Number(data.penalty_rate),
  }
}

export interface AdminContestRow {
  code: string
  title: string
  status: ContestStatus
  current_round: number
  quarters: number
  round_seconds: number
  penalty_rate: number
  is_open: boolean
  created_at: string
  players: number
  done_players: number
  player_names: string[]   // 대기실 참가자 이름 (대기 중일 때만, 들어온 순서)
}

/** 관리자: 만든 대회 목록 (관리자 키 확인). 키가 틀리면 wrong_admin_key 오류. */
export async function adminListContests(adminKey: string): Promise<AdminContestRow[]> {
  const client = requireClient()
  const { data, error } = await client.rpc('admin_list_contests', { p_admin_key: adminKey })
  if (error) throw toError(error)
  return (data ?? []) as AdminContestRow[]
}

async function adminAction(fn: string, adminKey: string, code: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.rpc(fn, { p_admin_key: adminKey, p_code: code })
  if (error) throw toError(error)
}

/** 관리자: 대기실을 닫고 모두 동시에 1분기를 시작한다. */
export const adminStartContest = (adminKey: string, code: string) => adminAction('admin_start_contest', adminKey, code)
/** 관리자: 지금 분기를 바로 넘긴다. */
export const adminForceNext = (adminKey: string, code: string) => adminAction('admin_force_next', adminKey, code)
/** 관리자: 새 참가를 막는다. */
export const adminCloseContest = (adminKey: string, code: string) => adminAction('admin_close_contest', adminKey, code)
/** 관리자: 종료된 대회를 참가자 기록과 함께 데이터베이스에서 삭제한다. (종료되지 않은 대회는 서버가 거부) */
export const adminDeleteContest = (adminKey: string, code: string) => adminAction('admin_delete_contest', adminKey, code)
