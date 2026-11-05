-- ============================================================================
-- shiftStocks 대회 모드 — Supabase 설정 (SQL Editor 에서 한 번 실행)
--
-- 대회 진행 방식 (전원 동기화)
--   1. 진행자가 대회를 만든다 (파일 맨 아래 예시). 참가자는 코드로 입장해 "대기실"에서 기다린다.
--   2. 진행자가 "대회 시작"을 누르면 모두 동시에 1분기를 시작한다. 시작 후에는 새로 참가할 수 없다.
--   3. 한 분기는 "전원이 마감"하거나 "제한시간(round_seconds)이 지나면" 모두 함께 다음 분기로 넘어간다.
--      제한시간이 지나도록 마감하지 못한 참가자는 그 분기에 페널티(penalty_rate)를 받고 자동으로 넘어간다.
--   4. 마지막 분기가 닫히면 대회가 끝난다.
--
-- 구조
--  * contests          대회 설정과 진행 상태. 시드(seed)와 진행자 키(host_key)가 들어 있어 브라우저에 직접 노출하지 않는다.
--  * contest_players   참가자별 진행 기록.
--  * 두 테이블은 RLS 를 켜고 정책을 만들지 않는다 → 브라우저(anon)는 테이블을 직접 읽거나 쓸 수 없다.
--  * 브라우저는 아래 함수로만 접근한다:
--      join_contest / get_round_state / finish_round / submit_score / get_leaderboard / host_start_contest / host_force_next
--  * 분기 전환은 별도 스케줄러 없이, 누군가 get_round_state 를 호출할 때마다 서버가 "넘길 때가 됐는지" 계산한다.
-- ============================================================================

create table if not exists public.contests (
  code            text primary key,                         -- 대문자 코드 (예: HELLO2026)
  title           text    not null default '',
  seed            text    not null,                         -- 같은 조건을 만드는 비밀 시드
  host_key        text    not null,                         -- 진행자 키 (대회 시작·강제 진행에 필요)
  quarters        int     not null default 8  check (quarters between 1 and 40),
  initial_capital bigint  not null default 10000000 check (initial_capital > 0),
  round_seconds   int     not null default 300 check (round_seconds between 30 and 3600),  -- 라운드 제한시간
  penalty_rate    numeric not null default 0.25 check (penalty_rate between 0 and 1),     -- 시간 초과 페널티
  starts_at       timestamptz not null default now(),       -- 이 시각부터 참가 가능
  ends_at         timestamptz,                              -- 이 시각 이후에는 새로 참가 불가 (비우면 제한 없음)
  is_open         boolean not null default true,            -- false 로 바꾸면 새 참가를 막는다
  status          text    not null default 'lobby' check (status in ('lobby', 'running', 'finished')),
  current_round   int     not null default 0,               -- 0 = 대기실, 1..quarters = 진행 중, quarters+1 = 종료
  round_started_at timestamptz,                             -- 현재 라운드가 시작된 시각
  created_at      timestamptz not null default now()
);

create table if not exists public.contest_players (
  code          text not null references public.contests(code) on delete cascade,
  nickname      text not null,
  token_hash    text not null,                              -- 기기 토큰의 해시 (본인 줄만 갱신하기 위함)
  quarter       int  not null default 0,                    -- 점수가 반영된 마감 분기 수
  total_assets  bigint,
  return_pct    numeric,
  finished      boolean not null default false,
  round_done    int  not null default 0,                    -- 마감을 눌렀거나(또는 시간이 지나) 닫힌 마지막 라운드
  penalty_rounds int[] not null default '{}',               -- 마감하지 못해 페널티를 받은 라운드들
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (code, nickname)
);

alter table public.contests        enable row level security;
alter table public.contest_players enable row level security;
revoke all on public.contests, public.contest_players from anon, authenticated;

-- ---------------------------------------------------------------------------
-- (내부) 넘길 때가 된 라운드를 닫는다. 전원이 마감했거나 제한시간이 지났으면 다음 라운드로 넘어간다.
--   오랫동안 아무도 호출하지 않았더라도 지난 라운드들을 순서대로 모두 닫는다.
--   브라우저에는 공개하지 않는다.
-- ---------------------------------------------------------------------------
create or replace function public._close_rounds(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.contests%rowtype;
  v_total  int;
  v_done   int;
  v_due    boolean;
  v_guard  int := 0;
begin
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 60;

    select * into c from public.contests where code = p_code for update;
    exit when not found or c.status <> 'running';

    select count(*), count(*) filter (where round_done >= c.current_round)
      into v_total, v_done
      from public.contest_players where code = c.code;

    v_due := now() >= c.round_started_at + make_interval(secs => c.round_seconds);
    exit when not (v_due or (v_total > 0 and v_done = v_total));

    -- 이 라운드를 마감하지 못한 참가자에게 페널티를 표시하고 라운드를 닫는다
    update public.contest_players
       set penalty_rounds = penalty_rounds || c.current_round,
           round_done     = c.current_round
     where code = c.code and round_done < c.current_round;

    if c.current_round >= c.quarters then
      update public.contests set status = 'finished', current_round = c.quarters + 1 where code = c.code;
    else
      update public.contests
         set current_round    = c.current_round + 1,
             -- 시간이 다 돼서 닫힌 경우 다음 라운드는 이전 마감 시각에 시작한 것으로 본다 (모두 같은 일정)
             round_started_at = case when v_due then c.round_started_at + make_interval(secs => c.round_seconds) else now() end
       where code = c.code;
    end if;
  end loop;
end;
$$;
revoke all on function public._close_rounds(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 대회 참가: 코드가 유효하고 대기실이 열려 있을 때만 시드와 설정을 돌려준다.
--   같은 이름 + 같은 기기 토큰이면 "이어하기"(진행 중이어도 가능), 다른 기기가 같은 이름을 쓰면 거부.
-- ---------------------------------------------------------------------------
create or replace function public.join_contest(p_code text, p_nickname text, p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c      public.contests%rowtype;
  pl     public.contest_players%rowtype;
  v_nick text := btrim(p_nickname);
  v_hash text;
  v_resumed boolean := false;
  v_now  bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if p_token is null or char_length(p_token) < 16 then raise exception 'invalid_token'; end if;
  if v_nick is null or char_length(v_nick) < 1 or char_length(v_nick) > 12 then raise exception 'invalid_nickname'; end if;
  v_hash := md5(p_token);

  perform public._close_rounds(upper(btrim(p_code)));
  select * into c from public.contests where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;

  select * into pl from public.contest_players where code = c.code and nickname = v_nick;
  if found then
    if pl.token_hash <> v_hash then raise exception 'nickname_taken'; end if;
    v_resumed := true;                                  -- 같은 기기의 이어하기
  else
    -- 새 참가자: 대기실이 열려 있는 동안에만 들어올 수 있다 (시작 후에는 참가 불가)
    if c.status <> 'lobby' then raise exception 'contest_started'; end if;
    if not c.is_open then raise exception 'contest_closed'; end if;
    if now() < c.starts_at then raise exception 'contest_not_started'; end if;
    if c.ends_at is not null and now() > c.ends_at then raise exception 'contest_closed'; end if;
    insert into public.contest_players (code, nickname, token_hash, quarter, total_assets, return_pct)
    values (c.code, v_nick, v_hash, 0, c.initial_capital, 0);
    select * into pl from public.contest_players where code = c.code and nickname = v_nick;
  end if;

  return json_build_object(
    'code', c.code, 'title', c.title, 'seed', c.seed, 'quarters', c.quarters,
    'initial_capital', c.initial_capital, 'round_seconds', c.round_seconds, 'penalty_rate', c.penalty_rate,
    'status', c.status, 'current_round', c.current_round,
    'resumed', v_resumed,
    'quarter', pl.quarter, 'finished', pl.finished, 'server_time', v_now);
end;
$$;

-- ---------------------------------------------------------------------------
-- 현재 라운드 상태 (브라우저가 몇 초마다 호출한다). 호출할 때 넘길 때가 됐는지도 계산한다.
-- ---------------------------------------------------------------------------
create or replace function public.get_round_state(p_code text, p_nickname text, p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.contests%rowtype;
  pl       public.contest_players%rowtype;
  v_total  int;
  v_done   int;
begin
  perform public._close_rounds(upper(btrim(p_code)));
  select * into c from public.contests where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;

  select * into pl from public.contest_players where code = c.code and nickname = btrim(p_nickname);
  if not found or pl.token_hash <> md5(coalesce(p_token, '')) then raise exception 'not_allowed'; end if;

  select count(*), count(*) filter (where round_done >= c.current_round and c.status = 'running')
    into v_total, v_done from public.contest_players where code = c.code;

  return json_build_object(
    'status', c.status,
    'current_round', c.current_round,
    'quarters', c.quarters,
    'round_seconds', c.round_seconds,
    'round_started_at', case when c.round_started_at is null then null else (extract(epoch from c.round_started_at) * 1000)::bigint end,
    'server_time', (extract(epoch from now()) * 1000)::bigint,
    'total_players', v_total,
    'done_players', v_done,
    'my_round_done', pl.round_done,
    'my_penalty_rounds', to_json(pl.penalty_rounds),
    'players', case when c.status = 'lobby'
                    then coalesce((select json_agg(nickname order by joined_at) from public.contest_players where code = c.code), '[]'::json)
                    else '[]'::json end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 이번 라운드 마감: "나는 투자를 마쳤다"고 표시한다. 전원이 마감하면 모두 다음 분기로 넘어간다.
-- ---------------------------------------------------------------------------
create or replace function public.finish_round(p_code text, p_nickname text, p_token text, p_round int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c  public.contests%rowtype;
  pl public.contest_players%rowtype;
begin
  perform public._close_rounds(upper(btrim(p_code)));
  select * into c from public.contests where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;

  select * into pl from public.contest_players where code = c.code and nickname = btrim(p_nickname);
  if not found or pl.token_hash <> md5(coalesce(p_token, '')) then raise exception 'not_allowed'; end if;

  if c.status <> 'running' or p_round <> c.current_round then raise exception 'round_mismatch'; end if;

  update public.contest_players
     set round_done = p_round, updated_at = now()
   where code = c.code and nickname = pl.nickname and round_done < p_round;

  perform public._close_rounds(c.code);   -- 내가 마지막 한 명이었다면 바로 다음 분기로
end;
$$;

-- ---------------------------------------------------------------------------
-- 점수 제출: 본인 기기 토큰이 맞을 때만, 마감 분기를 뒤로 되돌릴 수 없고 앞으로만 갱신할 수 있다.
--   (분기가 넘어가 가격이 바뀐 뒤의 총 자산을 올린다)
-- ---------------------------------------------------------------------------
create or replace function public.submit_score(
  p_code text, p_nickname text, p_token text,
  p_quarter int, p_total_assets bigint, p_finished boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c  public.contests%rowtype;
  pl public.contest_players%rowtype;
begin
  select * into c from public.contests where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;

  select * into pl from public.contest_players where code = c.code and nickname = btrim(p_nickname);
  if not found or pl.token_hash <> md5(coalesce(p_token, '')) then raise exception 'not_allowed'; end if;

  if pl.finished then return; end if;                                   -- 끝난 기록은 바꾸지 않는다
  if p_quarter < pl.quarter or p_quarter > c.quarters then raise exception 'invalid_quarter'; end if;
  if p_total_assets < 0 or p_total_assets > c.initial_capital * 1000 then raise exception 'invalid_score'; end if;

  update public.contest_players
     set quarter      = p_quarter,
         total_assets = p_total_assets,
         return_pct   = round((p_total_assets - c.initial_capital)::numeric * 100 / c.initial_capital, 2),
         finished     = (p_finished and p_quarter = c.quarters),
         updated_at   = now()
   where code = c.code and nickname = pl.nickname;
end;
$$;

-- ---------------------------------------------------------------------------
-- 순위표: 시드와 토큰, 진행자 키는 절대 포함하지 않는다.
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests%rowtype;
begin
  perform public._close_rounds(upper(btrim(p_code)));
  select * into c from public.contests where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;

  return json_build_object(
    'contest', json_build_object(
      'code', c.code, 'title', c.title, 'quarters', c.quarters,
      'initial_capital', c.initial_capital, 'is_open', c.is_open,
      'status', c.status, 'current_round', c.current_round, 'round_seconds', c.round_seconds),
    'players', coalesce((
      select json_agg(t) from (
        select nickname, quarter, total_assets, return_pct, finished, updated_at, round_done
          from public.contest_players
         where code = c.code
         order by return_pct desc nulls last, updated_at asc
         limit 500
      ) t
    ), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 진행자 전용: 진행자 키가 맞을 때만 동작한다.
-- ---------------------------------------------------------------------------
create or replace function public.host_start_contest(p_code text, p_host_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests%rowtype;
  v_players int;
begin
  select * into c from public.contests where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'contest_not_found'; end if;
  if c.host_key <> coalesce(p_host_key, '') then raise exception 'wrong_host_key'; end if;
  if c.status <> 'lobby' then raise exception 'already_started'; end if;

  select count(*) into v_players from public.contest_players where code = c.code;
  if v_players = 0 then raise exception 'no_players'; end if;

  update public.contests
     set status = 'running', current_round = 1, round_started_at = now()
   where code = c.code;
end;
$$;

-- 지금 라운드를 바로 닫고 다음 분기로 넘긴다 (자리를 비운 참가자가 있을 때 등)
create or replace function public.host_force_next(p_code text, p_host_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contests%rowtype;
begin
  select * into c from public.contests where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'contest_not_found'; end if;
  if c.host_key <> coalesce(p_host_key, '') then raise exception 'wrong_host_key'; end if;
  if c.status <> 'running' then raise exception 'not_running'; end if;

  -- 제한시간이 지난 것으로 만들어 바로 닫히게 한다
  update public.contests
     set round_started_at = now() - make_interval(secs => c.round_seconds)
   where code = c.code;
  perform public._close_rounds(c.code);
end;
$$;

grant execute on function public.join_contest(text, text, text)                            to anon, authenticated;
grant execute on function public.get_round_state(text, text, text)                         to anon, authenticated;
grant execute on function public.finish_round(text, text, text, int)                       to anon, authenticated;
grant execute on function public.submit_score(text, text, text, int, bigint, boolean)      to anon, authenticated;
grant execute on function public.get_leaderboard(text)                                     to anon, authenticated;
grant execute on function public.host_start_contest(text, text)                            to anon, authenticated;
grant execute on function public.host_force_next(text, text)                               to anon, authenticated;

-- ============================================================================
-- 대회 만들기 예시 (진행자가 SQL Editor 에서 실행)
--   * code 는 반드시 대문자
--   * seed 는 아무도 모르는 값이어야 한다 (아래처럼 무작위로 만들면 됨). 참가자에게 알려 주는 건 code 뿐이다.
--   * host_key 는 진행자만 아는 긴 문자열. 순위표 화면의 "진행자 메뉴"에서 대회 시작과 강제 진행에 쓴다.
--
-- insert into public.contests (code, title, seed, host_key, quarters)
-- values (
--   'HELLO2026',
--   '1반 모의투자 대회',
--   md5(random()::text || clock_timestamp()::text),
--   '여기에-진행자만-아는-긴-키',
--   8                                   -- 진행 분기 수
-- );
--
-- 참가 가능 기간을 제한하려면 starts_at / ends_at 을 같이 지정한다. (대회 시작 버튼을 누르면 그 뒤로는 새 참가가 막힌다)
-- 라운드 제한시간·페널티를 바꾸려면 round_seconds(초), penalty_rate(0~1) 컬럼을 같이 지정한다. (기본 300초, 0.25)
-- 대회를 닫으려면:  update public.contests set is_open = false where code = 'HELLO2026';
-- ============================================================================
