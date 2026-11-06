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
--      join_contest / get_round_state / finish_round / submit_score / forfeit_contest / get_leaderboard / host_start_contest / host_force_next / create_contest
--      admin_list_contests / admin_start_contest / admin_force_next / admin_close_contest / admin_delete_contest  (관리자 키로 대회 관리)
--  * 분기 전환은 별도 스케줄러 없이, 누군가 get_round_state 를 호출할 때마다 서버가 "넘길 때가 됐는지" 계산한다.
-- ============================================================================

create table if not exists public.contests (
  code            text primary key,                         -- 대문자 코드 (예: HELLO2026)
  title           text    not null default '',
  seed            text    not null,                         -- 같은 조건을 만드는 비밀 시드
  host_key        text    not null,                         -- 진행자 키 (대회 시작·강제 진행에 필요)
  quarters        int     not null default 8  check (quarters between 1 and 12),   -- 최대 12분기
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
  quarter_returns numeric[] not null default '{}',          -- 분기 마감 시점의 누적 수익률(%). 인덱스 = 분기 번호 (1부터), 아직 없는 분기는 null
  forfeited_quarter int,                                    -- 대회를 포기한 분기 번호 (포기하지 않았으면 null). 포기한 시점의 점수가 최종 기록이 된다
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (code, nickname)
);

-- 이미 예전 버전으로 만들어 둔 데이터베이스를 새 규칙에 맞춘다 (처음 설치할 때는 아무 일도 하지 않는다)
alter table public.contest_players add column if not exists quarter_returns numeric[] not null default '{}';
alter table public.contest_players add column if not exists forfeited_quarter int;
alter table public.contests drop constraint if exists contests_quarters_check;
alter table public.contests add  constraint contests_quarters_check check (quarters between 1 and 12);

-- 관리자 키 (사이트에서 대회를 만들 때 서버가 검사한다). 키 자체가 아니라 해시만 저장한다. 한 줄만 존재.
create table if not exists public.admin_settings (
  id        boolean primary key default true check (id),
  key_hash  text not null
);

alter table public.contests        enable row level security;
alter table public.contest_players enable row level security;
alter table public.admin_settings  enable row level security;
revoke all on public.contests, public.contest_players, public.admin_settings from anon, authenticated;

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
  v_break  constant int := 10;     -- 분기 사이 휴식(초). 클라이언트의 ROUND_BREAK_MS 와 같은 값이다
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
             -- 시간이 다 돼서 닫힌 경우 다음 라운드는 이전 마감 시각에 시작한 것으로 본다 (모두 같은 일정).
             -- 분기 사이에 v_break 초의 휴식을 둔다: 이 동안 참가자 화면에 순위가 뜨고, 다음 분기의 제한시간은 휴식이 끝난 뒤부터 센다.
             round_started_at = (case when v_due then c.round_started_at + make_interval(secs => c.round_seconds) else now() end)
                                + make_interval(secs => v_break)
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
    if pl.forfeited_quarter is not null then raise exception 'forfeited'; end if;   -- 포기한 대회에는 다시 들어올 수 없다
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
  if now() < c.round_started_at then raise exception 'round_not_started'; end if;   -- 분기 사이 휴식 중에는 마감할 수 없다

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
  c       public.contests%rowtype;
  pl      public.contest_players%rowtype;
  v_pct   numeric;
  v_rets  numeric[];
begin
  select * into c from public.contests where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;

  select * into pl from public.contest_players where code = c.code and nickname = btrim(p_nickname);
  if not found or pl.token_hash <> md5(coalesce(p_token, '')) then raise exception 'not_allowed'; end if;

  if pl.finished or pl.forfeited_quarter is not null then return; end if;   -- 끝났거나 포기한 기록은 바꾸지 않는다
  if p_quarter < pl.quarter or p_quarter > c.quarters then raise exception 'invalid_quarter'; end if;
  if p_total_assets < 0 or p_total_assets > c.initial_capital * 1000 then raise exception 'invalid_score'; end if;

  v_pct := round((p_total_assets - c.initial_capital)::numeric * 100 / c.initial_capital, 2);

  -- 분기별 누적 수익률 기록: 인덱스 = 분기 번호(1부터). 전체 분기 수만큼 null 로 채워 두고 이번 분기 칸만 채운다.
  v_rets := pl.quarter_returns;
  if coalesce(cardinality(v_rets), 0) < c.quarters then
    v_rets := coalesce(v_rets, '{}') || array_fill(null::numeric, array[c.quarters - coalesce(cardinality(v_rets), 0)]);
  end if;
  if p_quarter >= 1 then v_rets[p_quarter] := v_pct; end if;

  update public.contest_players
     set quarter         = p_quarter,
         total_assets    = p_total_assets,
         return_pct      = v_pct,
         quarter_returns = v_rets,
         finished        = (p_finished and p_quarter = c.quarters),
         updated_at      = now()
   where code = c.code and nickname = pl.nickname;
end;
$$;

-- ---------------------------------------------------------------------------
-- 대회 포기: 진행 중인 대회에서 중간에 나간다. 포기한 시점의 점수(p_total_assets)가 최종 기록이 되고, 포기한 분기가 함께 남는다.
--   * round_done 을 마지막 분기 너머로 올려서 "이미 모든 분기를 마감한 사람"으로 센다.
--     → 남은 참가자들이 포기한 사람을 기다리지 않고, 제한시간 페널티도 포기한 사람에게는 붙지 않는다.
--   * 이미 포기했다면 아무 일도 하지 않는다. 대기실·종료된 대회에서는 포기할 수 없다.
-- ---------------------------------------------------------------------------
create or replace function public.forfeit_contest(p_code text, p_nickname text, p_token text, p_total_assets bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c     public.contests%rowtype;
  pl    public.contest_players%rowtype;
  v_pct numeric;
begin
  perform public._close_rounds(upper(btrim(p_code)));
  select * into c from public.contests where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'contest_not_found'; end if;

  select * into pl from public.contest_players where code = c.code and nickname = btrim(p_nickname);
  if not found or pl.token_hash <> md5(coalesce(p_token, '')) then raise exception 'not_allowed'; end if;

  if pl.forfeited_quarter is not null then return; end if;
  if pl.finished or c.status <> 'running' then raise exception 'not_running'; end if;
  if p_total_assets < 0 or p_total_assets > c.initial_capital * 1000 then raise exception 'invalid_score'; end if;

  v_pct := round((p_total_assets - c.initial_capital)::numeric * 100 / c.initial_capital, 2);

  update public.contest_players
     set forfeited_quarter = c.current_round,
         total_assets      = p_total_assets,
         return_pct        = v_pct,
         round_done        = c.quarters + 1,
         updated_at        = now()
   where code = c.code and nickname = pl.nickname;

  perform public._close_rounds(c.code);   -- 내가 마지막으로 기다려지던 사람이었다면 바로 다음 분기로
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
        select nickname, quarter, total_assets, return_pct, finished, updated_at, round_done, quarter_returns, forfeited_quarter
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

-- ---------------------------------------------------------------------------
-- 관리자: 사이트에서 대회 만들기. 관리자 키가 맞을 때만 만들고, 시드·진행자 키는 서버가 무작위로 정한다.
--   code 를 비우면 6자리 코드를 자동으로 만든다. 진행자 키는 이 응답에서만 볼 수 있다.
-- ---------------------------------------------------------------------------
create or replace function public.create_contest(
  p_admin_key     text,
  p_title         text,
  p_code          text,
  p_quarters      int,
  p_round_seconds int,
  p_penalty_rate  numeric
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_hash  text;
  v_code  text := upper(btrim(coalesce(p_code, '')));
  v_host  text;
  v_tries int := 0;
begin
  select key_hash into v_hash from public.admin_settings where id;
  if v_hash is null then raise exception 'admin_not_configured'; end if;
  if v_hash <> encode(sha256(convert_to(coalesce(p_admin_key, ''), 'UTF8')), 'hex') then
    raise exception 'wrong_admin_key';
  end if;

  if coalesce(p_quarters, 0) not between 1 and 12 then raise exception 'invalid_settings'; end if;
  if coalesce(p_round_seconds, 0) not between 30 and 3600 then raise exception 'invalid_settings'; end if;
  if coalesce(p_penalty_rate, -1) not between 0 and 1 then raise exception 'invalid_settings'; end if;

  if v_code = '' then
    -- 자동 코드: 헷갈리는 글자(0 O 1 I)를 뺀 6자리
    loop
      v_code := '';
      for i in 1..6 loop
        v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
      end loop;
      exit when not exists (select 1 from public.contests where code = v_code);
      v_tries := v_tries + 1;
      if v_tries > 20 then raise exception 'code_taken'; end if;
    end loop;
  else
    if v_code !~ '^[A-Z0-9_-]{3,20}$' then raise exception 'invalid_code'; end if;
    if exists (select 1 from public.contests where code = v_code) then raise exception 'code_taken'; end if;
  end if;

  v_host := md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text);

  insert into public.contests (code, title, seed, host_key, quarters, round_seconds, penalty_rate)
  values (
    v_code,
    left(btrim(coalesce(p_title, '')), 60),
    md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text),
    v_host, p_quarters, p_round_seconds, p_penalty_rate
  );

  return json_build_object(
    'code', v_code,
    'title', left(btrim(coalesce(p_title, '')), 60),
    'host_key', v_host,
    'quarters', p_quarters,
    'round_seconds', p_round_seconds,
    'penalty_rate', p_penalty_rate
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 관리자 전용 관리 함수: 진행자 키 대신 관리자 키로 대회를 보고 시작·넘기기·닫기를 한다.
--   (대회를 만든 화면을 벗어나 진행자 키를 잃어도 관리자 화면에서 계속 진행할 수 있다)
-- ---------------------------------------------------------------------------
create or replace function public._check_admin(p_admin_key text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_hash text;
begin
  select key_hash into v_hash from public.admin_settings where id;
  if v_hash is null then raise exception 'admin_not_configured'; end if;
  if v_hash <> encode(sha256(convert_to(coalesce(p_admin_key, ''), 'UTF8')), 'hex') then
    raise exception 'wrong_admin_key';
  end if;
end;
$$;
revoke all on function public._check_admin(text) from public, anon, authenticated;

create or replace function public.admin_list_contests(p_admin_key text)
returns json
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  perform public._check_admin(p_admin_key);
  -- 진행 중인 대회는 넘길 때가 됐는지 먼저 계산해서 최신 상태로 보여 준다
  for r in select code from public.contests where status = 'running' loop
    perform public._close_rounds(r.code);
  end loop;

  return coalesce((
    select json_agg(t order by t.created_at desc) from (
      select c.code, c.title, c.status, c.current_round, c.quarters, c.round_seconds,
             c.penalty_rate, c.is_open, c.created_at,
             (select count(*) from public.contest_players p where p.code = c.code)::int as players,
             (select count(*) from public.contest_players p
               where p.code = c.code and c.status = 'running' and p.round_done >= c.current_round)::int as done_players,
             -- 대기실 참가자 이름 (들어온 순서). 시작한 뒤에는 순위표에서 볼 수 있어 비워 둔다.
             case when c.status = 'lobby'
                  then coalesce((select json_agg(p.nickname order by p.joined_at) from public.contest_players p where p.code = c.code), '[]'::json)
                  else '[]'::json end as player_names
        from public.contests c
       order by c.created_at desc
       limit 100
    ) t
  ), '[]'::json);
end;
$$;

create or replace function public.admin_start_contest(p_admin_key text, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_host text;
begin
  perform public._check_admin(p_admin_key);
  select host_key into v_host from public.contests where code = upper(btrim(p_code));
  if v_host is null then raise exception 'contest_not_found'; end if;
  perform public.host_start_contest(p_code, v_host);
end;
$$;

create or replace function public.admin_force_next(p_admin_key text, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_host text;
begin
  perform public._check_admin(p_admin_key);
  select host_key into v_host from public.contests where code = upper(btrim(p_code));
  if v_host is null then raise exception 'contest_not_found'; end if;
  perform public.host_force_next(p_code, v_host);
end;
$$;

-- 새 참가를 막는다 (이미 들어온 참가자의 진행에는 영향 없음)
create or replace function public.admin_close_contest(p_admin_key text, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public._check_admin(p_admin_key);
  update public.contests set is_open = false where code = upper(btrim(p_code));
  if not found then raise exception 'contest_not_found'; end if;
end;
$$;

-- 종료된 대회를 참가자 기록과 함께 삭제한다 (contest_players 는 on delete cascade).
--   진행 중이거나 대기 중인 대회는 삭제할 수 없다 (실수로 참가자 기록을 지우지 않도록 서버에서 막는다).
create or replace function public.admin_delete_contest(p_admin_key text, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  perform public._check_admin(p_admin_key);
  select status into v_status from public.contests where code = upper(btrim(p_code)) for update;
  if v_status is null then raise exception 'contest_not_found'; end if;
  if v_status <> 'finished' then raise exception 'not_finished'; end if;
  delete from public.contests where code = upper(btrim(p_code));
end;
$$;

grant execute on function public.admin_list_contests(text)          to anon, authenticated;
grant execute on function public.admin_delete_contest(text, text)   to anon, authenticated;
grant execute on function public.admin_start_contest(text, text)    to anon, authenticated;
grant execute on function public.admin_force_next(text, text)       to anon, authenticated;
grant execute on function public.admin_close_contest(text, text)    to anon, authenticated;

grant execute on function public.join_contest(text, text, text)                          to anon, authenticated;
grant execute on function public.get_round_state(text, text, text)                         to anon, authenticated;
grant execute on function public.finish_round(text, text, text, int)                       to anon, authenticated;
grant execute on function public.submit_score(text, text, text, int, bigint, boolean)      to anon, authenticated;
grant execute on function public.get_leaderboard(text)                                     to anon, authenticated;
grant execute on function public.forfeit_contest(text, text, text, bigint)                 to anon, authenticated;
grant execute on function public.host_start_contest(text, text)                            to anon, authenticated;
grant execute on function public.host_force_next(text, text)                               to anon, authenticated;
grant execute on function public.create_contest(text, text, text, int, int, numeric)        to anon, authenticated;

-- ============================================================================
-- 관리자 키 등록 (SQL Editor 에서 한 번 실행). 사이트 관리자 화면(/admin/contests)에서 대회를 만들 때 이 키를 입력한다.
--   * 길고 추측하기 어려운 값으로 정한다. 키를 바꾸고 싶으면 같은 문장을 다시 실행하면 된다.
--
-- insert into public.admin_settings (id, key_hash)
-- values (true, encode(sha256(convert_to('여기에-관리자-키', 'UTF8')), 'hex'))
-- on conflict (id) do update set key_hash = excluded.key_hash;

-- ============================================================================
-- 대회 직접 만들기 예시 (사이트 관리자 화면을 쓰지 않고 SQL Editor 에서 만들 때)
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
