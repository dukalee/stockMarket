# shiftStocks (MockStockMarket)

분기 단위 턴제 가상 주식 거래 시뮬레이터. React + Vite + TypeScript.

> **⚠️ 턴제 설계 원칙**: 실시간 가격 틱은 없다. `useMarketSimulation` 훅은 파일만 존재하고 어디서도 호출하지 않는다. 분기 진행 시에만 가격이 변동된다.

---

## 파일 참조 가이드

| 파일 | 참고할 때 |
|------|----------|
| `src/types/index.ts` | 모든 타입·인터페이스 정의 확인 |
| `src/utils/constants.ts` | 게임 상수값 확인 (초기 자본 ₩10,000,000, 분기 설정 등) |
| `src/data/stocks.ts` | 종목 목록·초기 주가·섹터 확인 |
| `src/engines/priceEngine.ts` | GBM 가격 계산 함수 (현재 미사용 — 턴제이므로 호출 안 함) |
| `src/engines/eventEngine.ts` | 분기 진행 시 priceImpact 합산 + 반전(flip) 주사위 로직. NOISE_RANGE=10 |
| `src/engines/staticNewsEngine.ts` | 미리 작성된 뉴스 풀에서 분기 뉴스 8개 구성 (API 키 불필요) |
| `src/utils/seededRandom.ts` | 시드 난수 (`createRng`) — 대회 모드에서 같은 조건을 만드는 데 사용 |
| `src/lib/supabase.ts`, `src/services/contest.ts`, `src/services/contestSync.ts` | 대회 서버 연결·참가·점수 전송·순위표 |
| `supabase/schema.sql` | 대회 모드 서버 설정 SQL (Supabase SQL Editor에서 실행) |
| `src/pages/LeaderboardPage.tsx` | 대회 순위표 (`/leaderboard`) |
| `src/hooks/useRoundTimer.ts` | 대회 라운드 남은 시간 표시 |
| `src/hooks/useContestSync.ts`, `src/services/quarterAdvance.ts` | 대회 동기화(서버 라운드 폴링, 분기 진행, 대기실 시작, 마감) |
| `src/pages/LobbyPage.tsx`, `src/components/layout/RoundWaitBanner.tsx` | 대회 대기실, 마감 후 대기 안내 |
| `src/components/modals/FinalResultModal.tsx`, `TimeoutNoticeModal.tsx` | 최종 결과, 시간 초과 안내 |
| `src/data/newsPool.ts` | 뉴스 기사 풀 (강도·서프라이즈별 기사 원문) |
| `src/engines/newsEngine.ts` | gpt-4.1-mini 뉴스 생성 — 현재 미사용 (코드만 보존) |
| `src/stores/gameStore.ts` | 게임 진행 상태 (year, quarter, phase[setup/playing/advancing/finished], mode, contest, 라운드 타이머, 페널티). 저장됨(persist) |
| `src/stores/marketStore.ts` | 종목·뉴스·가격 상태. `lastFlipped`, `lastFlippedArticleId`, `newsLoadingProgress`(0~8) 포함 |
| `src/stores/portfolioStore.ts` | 현금·보유종목·거래내역·`prevQuarterPositions` 상태 |
| `src/hooks/useMarketSimulation.ts` | 실시간 틱 훅 — **사용 안 함** (의도적 미호출, 턴제 설계) |
| `src/hooks/useQuarterAdvance.ts` | 분기 진행 흐름. `{ advance, isAdvancing, advanceError }` 반환 |
| `src/pages/SetupPage.tsx` | 타이틀 화면 — 신문 1면. 위: 게임 규칙 / 투자자 등록서 / 오늘의 주가, 아래: 오늘의 기사 / 오늘의 차트. 열 때마다 `resetMarket()`으로 시작가를 새로 뽑음 |
| `src/components/title/LivePriceBoard.tsx` | 오늘의 주가 — 1.4초마다 3개 종목 가격·등락이 무작위로 바뀌고 숫자는 굴러가며 바뀜. 차트에 나오는 종목은 음영 표시 (장식용) |
| `src/components/title/RollingNumber.tsx` | 자릿수별로 위아래로 굴러가는 숫자 표시 (오도미터식, `.roll-strip` 트랜지션) |
| `src/stores/titleLiveStore.ts` | 타이틀 전용 라이브 시세 — 주가표와 차트가 같은 가격·캔들을 공유. 게임 상태(marketStore)와 분리 |
| `src/components/title/NewsRotator.tsx` | 오늘의 기사 — 장식용 기사 3개가 6초마다 옆으로 슬라이드 (진행 막대 표시, 마우스 올리면 일시정지) |
| `src/components/title/LiveChart.tsx` | 오늘의 차트 — 주가표에서 음영 표시된 종목의 가격 변화를 그대로 그림. 가격이 바뀔 때마다 새 캔들이 붙고 7번 갱신마다 다음 종목으로 바뀜 |
| `src/data/titleNews.ts` | 타이틀 화면 전용 장식 기사 3개 (게임 뉴스 풀과 무관) |
| `src/pages/HomePage.tsx` | 포트폴리오 대시보드 + 게임 규칙 & 분기 조건 달성 현황 |
| `src/pages/TradePage.tsx` | 종목 목록·차트·매수매도 화면 |
| `src/pages/NewsPage.tsx` | AI Times 스타일 뉴스 목록 (white tone, NYT 레이아웃) |
| `src/pages/NewsArticlePage.tsx` | 뉴스 기사 상세 페이지 (white tone) |
| `src/pages/AdminLoginPage.tsx` | 관리자 로그인 (비밀번호: rootroot) |
| `src/pages/AdminDashboardPage.tsx` | 관리자 대시보드 — 아래 §Admin 대시보드 섹션 참조 |
| `src/components/layout/NavBar.tsx` | 내비게이션·"Continue →" 버튼·분기 인디케이터·조건 모달·advanceError 배너 |
| `src/components/layout/AppShell.tsx` | 공통 레이아웃 래퍼. `advanceError` prop 전달 |
| `src/components/market/StockList.tsx` | 종목 사이드바 — 보유 종목 필터·미선택 시 SSEI 자동 선택 |
| `src/components/market/StockRow.tsx` | 종목 행 — 한글명·원 단위 현재가·등락 (2줄 레이아웃) |
| `src/components/market/StockDetail.tsx` | 종목 상세 — 한글명 메인, 심볼 서브 |
| `src/components/market/PriceChart.tsx` | 순수 SVG 캔들스틱 차트 — 분기당 100 미니캔들, 브라운 브릿지 보간, 거래량 바 |
| `src/components/portfolio/HoldingsTable.tsx` | 보유 종목 테이블 — 행별 매수/매도 버튼 (→ `/trade` 이동) |
| `src/components/trading/TradePanel.tsx` | 매수/매도 패널 — 이번 분기 매수 수량은 같은 분기에 매도 불가 |
| `src/App.tsx` | 라우팅 구조 확인 |

---

## 게임 흐름

```
SetupPage
  유저명 + 초기 자본 입력
  → startGame() + initPortfolio()
  → generateQuarterNews(1, 1, stocks, onProgress)  ← Q1 뉴스 생성 (8단계 진행)
  → 실패 시: 에러 표시 + 진행 차단 (navigate 안 됨)
  → 성공 시: navigate('/')

playing 페이즈 (Q1)
  가격 고정 (틱 없음)
  사용자 거래 가능 (이번 분기에 산 수량은 같은 분기에 매도 불가)

NavBar "Continue →" 클릭
  → 조건 미충족 시: 조건 모달 표시 (분기 진행 차단)
  → 충족 시: 확인 모달 → useQuarterAdvance.advance()
      1. computePriceChanges(currentNews)  ← 현재 분기 뉴스 impact 합산 + 반전 주사위
      2. applyQuarterPriceChanges(changes, "Y1Q1")  ← 가격 일괄 적용 + quarterLabel 기록
      3. snapshotPositions()  ← 현재 포트폴리오 스냅샷 저장 (다음 분기 비교용)
      4. nextQuarter()
      5. generateQuarterNews(nextYear, nextQ, stocks, onProgress)
         실패 시: setNews([]) + advanceError 노출
      6. setPhase('playing')

  ※ 2번 직후 React 재렌더 → 차트에 분기 데이터 즉시 반영 (뉴스 생성 대기 중에도 차트 표시)
```

---

## 게임 모드 — 시뮬레이션 / 대회

| | 시뮬레이션 (대회 코드 없음) | 대회 (대회 코드 입력) |
|---|---|---|
| 분기 수 | **4분기** (`SIMULATION_QUARTERS`) | 대회 설정(`contests.quarters`, 기본 8) |
| 조건 | 매번 무작위 | 같은 코드면 모두 같은 시작가·기사·등락(시드) |
| 분기 진행 | 사용자가 "다음 분기로"를 누르면 바로 | **전원 동기화**: 전원이 마감하거나 제한시간이 지나면 모두 함께 다음 분기로 |
| 제한시간 | 없음 | 분기마다 5분 (`round_seconds`) — 마감하지 못하면 현금과 보유 주식의 25% 차감 (`penalty_rate`) 후 자동 진행 |
| 시작 | 바로 | 대기실에서 기다리다 **진행자가 시작 버튼**을 누르면 동시에 1분기 시작. 시작 후 새 참가 불가 |
| 종료 | 마지막 분기 마감 시 최종 결과 팝업 | 최종 결과 + 순위표(Supabase) |
| 관리자 화면 | 사용 가능 | **대회 중 차단** (다음 분기 영향 수치가 보이기 때문) |

- 시작은 `SetupPage`의 투자자 등록서. 이름 + 대회 코드(선택) + 초기 자본(대회에서는 서버 설정으로 고정)
- **"처음 화면으로" 버튼**(NavBar, 시뮬레이션 전용): 확인 후 현재 시뮬레이션을 포기하고 `/setup`으로 돌아간다 (`resetAllGameState`). 끝난 게임에서는 확인 없이 이동. 대회 모드에서는 보이지 않는다
- **진행 중인 게임이 있으면 새로 시작할 수 없다** (`/setup`은 "이어서 하기"만). 대회 중에는 버리고 새로 시작도 불가 — 결과를 보고 다시 도전하는 것을 막는다
- 게임 상태는 `localStorage`에 저장돼 새로고침해도 이어진다 (`shiftstocks-game/portfolio/market`)
- 마지막 분기에서는 버튼이 "마지막 분기 마감"이 되고, 마감하면 `phase = 'finished'` → `FinalResultModal`. 마감 후에는 거래 불가
- `GamePhase`: `setup` → (대회만) `lobby` → `playing` ⇄ `advancing` → `finished`

### 대회 모드 구조
- **시드**: 서버(`contests.seed`)가 가진 비밀 값. 코드만으로는 알 수 없고 `join_contest`가 줄 때만 받는다 (임의 진입 방지)
  - 시작가 `${seed}:start`, 분기별 기사 `${seed}:news:${분기번호}`, 분기별 주사위·노이즈 `${seed}:outcome:${분기번호}`
  - `src/utils/seededRandom.ts`(`createRng`), `staticNewsEngine`·`eventEngine`·`stocks.ts`가 `seed`/`rng`를 받는다. 이전 분기를 같은 시드로 다시 계산해 "이미 나온 기사 제외" 상태를 재현한다
- **임의 진입 방지**: 코드가 존재 + `is_open` + `starts_at ≤ now ≤ ends_at` + **대기실 상태(`lobby`)** 일 때만 새로 참가. 이름은 대회 안에서 유일, 같은 기기 토큰(`shiftstocks-device-token`)만 이어하기 가능
- **서버 (`supabase/schema.sql`)**: 테이블 2개 + 함수, RLS로 직접 접근 차단
  - `join_contest`, `get_round_state`, `finish_round`, `submit_score`, `get_leaderboard`, `host_start_contest`, `host_force_next`, (내부) `_close_rounds`
  - 라운드 전환은 스케줄러 없이, 누군가 `get_round_state`를 호출할 때 `_close_rounds`가 "전원 마감 또는 제한시간 초과"를 계산해서 닫는다. 오래 방치돼도 지난 라운드를 순서대로 모두 닫는다
  - 마감하지 못한 참가자는 `penalty_rounds`에 그 라운드가 기록된다
  - 대회 만들기: SQL Editor에서 `contests`에 insert (예시는 schema.sql 맨 아래). 코드는 대문자, `host_key`는 진행자만 아는 키
  - 환경 변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env.example`, Vercel에도 추가). 없으면 대회 모드는 꺼지고 시뮬레이션만 동작
- **클라이언트 흐름**
  1. 참가 → `enterLobby` → `/lobby` (`LobbyPage`, 참가자 목록·규칙)
  2. `useContestSync`(App에서 1회, 2.5초마다 `get_round_state`): 서버가 `running`이면 `beginContestGame`으로 1분기를 열고, 서버 라운드가 내 분기보다 앞서면 `advanceQuarter`로 따라간다
  3. "이번 분기 마감" → `markRoundDone` → `finish_round`. 마감 후엔 거래 잠금 + `RoundWaitBanner`("n / m명 마감")
  4. 서버가 라운드를 넘기면 `advanceQuarter`가 (내 분기에 페널티가 표시돼 있으면 `applyPenalty` 후) 시드 결과를 적용하고 다음 분기 뉴스를 만든 뒤 `syncContestScore`로 점수 전송
  - 제한시간 표시는 서버가 정한 라운드 시작 시각 + 서버 시각 오프셋(`clockOffsetMs`)으로 계산
- **페널티**: `portfolioStore.applyPenalty(rate)` — 현금은 반올림한 25%, 주식은 종목별 25%에 가장 가까운 정수 주(1주만 있으면 잃지 않음). 안내는 `TimeoutNoticeModal`
- **진행자**: `/leaderboard?code=...`의 "진행자 메뉴"에서 진행자 키로 "대회 시작", "지금 다음 분기로 넘기기"
- **순위표**: 로그인 없이 코드만으로 열람, 10초마다 갱신, 수익률 순
- **검증**: `supabase/schema.sql`은 실제 Postgres 엔진(pglite)으로 다중 참가자 시나리오를 돌려 확인했고, 클라이언트 전체 흐름은 가짜 서버를 붙인 브라우저 3개(참가자 2 + 진행자)로 확인했다
- **한계**: 점수는 브라우저가 보내므로 조작 가능하고, 시드는 참가자 브라우저에 있어 개발자 도구로 미래 분기를 미리 계산할 수 있다. 엄격한 대회가 필요하면 서버가 분기마다 기사를 내려 주거나 매매 기록을 서버에서 재검증해야 한다

---

## 핵심 메커니즘

### 분기 가격 변동 (`eventEngine.ts`)
- 현재 분기 뉴스의 `priceImpact` 합산
- **반전(flip)**: 기사 순서대로 1d6 — 1이 나오면 해당 기사 impact 부호 반전. 첫 발동 후 이후 기사는 정상 적용. 분기당 최대 1회
- **±10% 균등 노이즈** 추가 (`NOISE_RANGE = 10`)
- `applyQuarterPriceChanges` 에서 `openPrice = 이전currentPrice` 로 보존 → 등락 기준선

### 뉴스 생성 (`staticNewsEngine.ts`) — 미리 작성된 뉴스 풀
**API 키·서버 불필요.** `src/data/newsPool.ts`에 번들된 기사 풀(`NEWS_POOL`)에서 분기마다 8개를 뽑는다. (정적 배포만으로 동작)
- 시그니처: `generateQuarterNews(year, quarter, stocks, onProgress)`
- 풀 기사: `sector`, `scope`(global/local), `sentiment`·`strength`(실제 방향/강도), `surprise`, `headline/subheadline/summary/paragraphs`
- 기사 원문은 `src/data/newsPool/part*.ts`(partA 약간·partB 보통·partC 매우·partD 서프라이즈 긍정·partE 서프라이즈 부정)에 있고 `newsPool.ts`가 합친다. 공통 도구는 `newsPool/base.ts`의 `e()`
- **기사 작성 기준**: 본문 약 900~1,200자·7~9문단, 첫 문단은 `서울=AI Times`로 시작하는 리드, 수치 4~5개 이상, 허구·익명 인용 1~2개 이상, 배경·업계 상황·후속 일정 포함. 실제 기업·인물·기관·언론사명과 주가 방향 예측·투자 권유 표현 금지. local 기사만 `{회사}` 사용
- local 기사 본문의 `{회사}` 는 같은 섹터의 종목명으로 치환 (같은 분기 내 동일 종목 중복 금지)
- 구성: 6가지 강도 1개씩 + 랜덤 2개, 그중 moderate/strong 2개는 `isSurprise`, 서프라이즈 아닌 1개는 `isInverted`(본문 방향과 반대로 +/-1~5%), global 4 / local 4 (선호 조건 — 풀 부족 시 어긋날 수 있음)
- 이미 쓴 기사는 세션 내에서 제외(`usedPoolIds`), 소진 시 재사용
- 기자명 `KOREAN_REPORTER_NAMES` 15명 인덱스 순 배정, 날짜는 분기 범위 내 서로 다른 날짜
- 기사마다 `onProgress(i+1)` 호출 → 0~8 진행률 (순차)
- 기사 추가: `newsPool.ts`의 `e(...)` 항목 추가 (카테고리 6종 × 일반 5개 이상, 서프라이즈 4종 × 2개 이상 유지)
- `newsEngine.ts`(OpenAI 2단계 생성)는 코드만 남아 있고 **호출하지 않음**

**기사 강도 배분 (분기당 고정 구성)**
| 구성 | 강도 | priceImpact 범위 |
|------|------|----------------|
| 1개 | 약간 부정 (slight bearish) | -10 ~ -25% |
| 1개 | 부정 (moderate bearish) | -25 ~ -50% |
| 1개 | 매우 부정 (strong bearish) | -50 ~ -90% |
| 1개 | 약간 긍정 (slight bullish) | +10 ~ +25% |
| 1개 | 긍정 (moderate bullish) | +25 ~ +50% |
| 1개 | 매우 긍정 (strong bullish) | +50 ~ +90% |
| 2개 | 랜덤 | 위 6가지 중 자유 선택 |

범위는 `staticNewsEngine.ts`의 `IMPACT_RANGE`에서 조정한다. 역행(isInverted) 기사는 본문 방향과 반대로 1~5%만 적용된다. 최종 가격은 100원 단위로 반올림되며 최저 100원이다.

`priceImpact`: global → 섹터 전체 종목, local → 1개 종목

**기사 작성 스타일 (strength별)**
- `strong`: 단방향 명확 — 해당 방향 정보만, 전문가 의견도 동방향, 명확한 결론
- `moderate`: 반전 후 수렴 — 앞 30~40% 반대 방향으로 시작, 후반 60%에서 본 방향으로 수렴
- `slight`: 최대 모호 — 긍정·부정 50:50, 결론 없이 "지켜봐야 한다"로 마무리
- **수치·통계 3개 이상 필수** (매출 변화율, 시장 규모, 계약 금액, 거시 지표 등)

**반전 서프라이즈 기사 (`isSurprise: true`)**
- 분기당 정확히 2개 지정 (moderate/strong 대상 권장)
- 헤드라인 + 도입부: 실제 방향의 **반대** 방향 강하게 암시
- 본문 중반 전환 단락 ("다만", "역설적으로"): 반전 포인트
- 본문 후반: 진짜 방향 수치로 드러남 → 끝까지 읽은 독자만 파악

### 로딩 진행률
- `newsLoadingProgress`: 0~8 (기사 완성 수) — 퍼센트가 아님
- NavBar/SetupPage: 8칸 세그먼트 바
  - 완료된 칸: 초록 solid
  - 로딩 중 미완료 칸: `animate-pulse` (병렬 생성이므로 완료 순서 비순차)

### 차트 (`PriceChart.tsx`) — 순수 SVG 캔들스틱 (확대·축소 지원)
- Recharts 제거, ResizeObserver 기반 순수 SVG 렌더링
- **분기당 100개 미니캔들** (`STEPS = 100`), 캔들 데이터는 `useMemo`로 캐시
- **가격 경로 (`seededWave`)**: 분기 시작가 → 종가를 잇되 실제 주가처럼 보이게 — 변동성 군집(조용/격렬 구간 교대), 평균 회귀(톱니 움직임), 5% 확률 급등락 스파이크, 분기 내 큰 파동. 마지막 값은 정확히 종가로 보정. seed 가 같으면 항상 같은 모양
- 각 미니캔들: open/close = 연속 경로, high/low = seeded wick, 큰 움직임일수록 거래량 증가 (하단 18% 거래량 바)
- **확대·축소·이동**: 마우스 휠(커서 위치 기준 확대), 드래그로 좌우 이동, `1분기`/`전체`/`−`/`+` 버튼, 더블클릭으로 기본 보기(최근 2분기). 최소 12개 캔들까지 확대
- 가격 축은 **보이는 구간 기준으로 자동 조정**(확대하면 세밀하게 보임). 현재가선·현재가 태그, 십자선과 가격 태그, 호버 툴팁(분기·구간 번호·시가/종가/고가/저가/등락%)
- 새 분기 데이터가 들어오면 보기는 기본 보기로 리셋
- 분기 경계: 수직 점선 + X축 라벨(`Y1Q1` 등)
- 첫 분기부터 표시: 게임 시작 시 `priceHistory`에 `시작 전` 구간(시작가 → 현재가)이 들어 있어 Q1에도 차트와 등락률이 보임. 가격 이력이 전혀 없을 때만 "분기를 진행하면 차트가 표시됩니다" 안내

### 포트폴리오 스냅샷 (`portfolioStore.ts`)
- `prevQuarterPositions: Record<string, Position>` — 이전 분기 종료 시점 보유 종목 복사본
- `snapshotPositions()` — `useQuarterAdvance`에서 분기 진행 시 호출
- 분기 진행 조건 3번(포트폴리오 변경)의 비교 기준으로 사용

### `PricePoint` 타입 (`types/index.ts`)
```ts
interface PricePoint {
  timestamp: number
  price: number
  quarterLabel?: string  // "Y1Q1", "Y1Q2", ... — applyQuarterPriceChanges 시점에만 기록
}
```
`quarterLabel`이 있는 포인트만 차트 분기 경계로 사용.

### `NewsArticle` 주요 필드 (`types/index.ts`)
```ts
interface NewsArticle {
  sentiment: 'bullish' | 'bearish' | 'neutral'
  strength:  'slight' | 'moderate' | 'strong'   // 기사 강도
  isSurprise: boolean                             // 반전 서프라이즈 기사 여부
  priceImpact: Record<string, number>             // 종목별 % 영향
  targetType:  'global' | 'local'
  targetSector?: string
}
```

---

## 게임 규칙

### 매도 정책 (`TradePanel.tsx`)
- **이번 분기에 매수한 수량은 같은 분기에 매도할 수 없다.** 다음 분기부터 매도 가능
- 매도 가능 수량 = 보유 수량 − 이번 분기 매수 수량 (`getSellableShares`, `portfolioStore.ts`). `sellStock`에서도 검증하고 `TradePanel`은 매도 가능 수량을 표시
- 이전 분기부터 보유한 수량은 이번 분기에도 자유롭게 매도 가능
- 분기 매수 조건 카운트는 보유 수량 > 0 인 종목만 카운트

### 분기 진행 조건 (`NavBar.tsx`)
매 분기 진행 전 **세 조건 모두** 충족 필요:
1. 서로 다른 종목 **2개 이상** 매수 후 보유 (`REQUIRED_STOCKS = 2`)
2. 서로 다른 섹터 **2개 이상** 매수 후 보유 (`REQUIRED_SECTORS = 2`)
3. 현재 보유 포트폴리오가 **이전 분기와 달라야** 함 (종목 구성 또는 수량 변경)

- 조건 판정: 매수 거래 중 `positions[id].shares > 0` 인 종목만 카운트
- 미충족 시: "Continue →" 버튼 노란색 → 클릭 시 조건 모달 (어떤 조건이 미달인지 표시)
- NavBar 버튼 옆: 분기 인디케이터 `●—●—○—○` (지난 분기=초록 채움, 현재=흰 링, 미래=빈 원)
- NavBar 상태 배지 없음 (조건 상세는 모달로만 확인)

---

## Admin 대시보드 (`/admin/dashboard`)

탭 구성: **요약 / 기술 / 교육 / 금융 / 물류 / 게임 / 뉴스**

### 요약 탭

**위험 요소 배너** — 분기 진행 후 항상 표시
- 미발동: "위험 요소 미발동" 안내
- 발동 시: 반전 기사 제목 + 영향 종목 칩 목록 (`심볼 한글명 원래% → 반전%`)

**투자 조언** — 기사 합산 기준값 (±10% noise 미적용)
1. 강세 분야: sectorImpact > 2% 섹터 + 대표 기사 헤드라인
2. 약세 분야: sectorImpact < -2% 섹터 + 대표 기사 헤드라인
3. 추천 종목 Top 5: 상승 예상 상위 5개 + 예상 변동률 + 근거 기사 헤드라인

**전체 종목 예상 변동 순위** — 15개 전종목 (0.0% 포함)

### 섹터 탭 (기술/교육/금융/물류/게임)
- 탭 버튼에 섹터 영향도 % 표시
- 전체 영향 행: 글로벌 기사 합산 + 헤드라인 목록
- 종목 행: 로컬 기사만 표시, 우측 `전체+종목=합산` 분해

### 뉴스 탭
- 헤드라인 + 배지 + summary + 영향 종목 칩
- **배지 구성** (왼쪽→오른쪽):
  - `⚡ 반전` (노란색) — `isSurprise: true` 기사에만 표시
  - 강도 배지 (`약간 부정` / `부정` / `매우 부정` / `약간 긍정` / `긍정` / `매우 긍정`) — 강도별 색 농도
- 감성 배지(긍정↑/부정↓) 별도 표시 없음 (강도 배지와 중복이므로 제거)

---

## 스토어 구조

| 스토어 | 주요 상태 |
|--------|----------|
| `gameStore` | `userName`, `initialCapital`, `currentYear`, `currentQuarter`, `phase`(setup/playing/advancing), `adminAuth` |
| `marketStore` | `stocks[]`, `currentNews[]`, `newsLoading`, `newsLoadingProgress`(0~8 기사수), `lastFlipped`, `lastFlippedArticleId` |
| `portfolioStore` | `cash`, `positions{}`, `transactions[]`, `prevQuarterPositions{}` |

---

## 에러 처리

| 위치 | 동작 |
|------|------|
| `SetupPage` Q1 뉴스 실패 | 에러 메시지 표시 + `navigate('/')` 차단. 풀 조회 실패 시에만 발생 (정상적으로는 발생하지 않음) |
| `useQuarterAdvance` 뉴스 실패 | `setNews([])` + `advanceError` 상태 노출 → NavBar 빨간 배너 표시. Admin 대시보드에서 "뉴스 다시 생성" 가능 |

---

## 디자인 시스템 — "석간(Broadsheet)" (B안)
앱 전체가 신문 지면 콘셉트. 토큰은 `src/index.css`의 `@theme`에 정의 (Tailwind 유틸로 사용).
- 색: `paper`(배경 #F1F1ED), `paper-card`(박스), `paper-deep`(선택행), `ink`(본문·굵은 선), `ink-soft`, `mute`(라벨), `rule`(가는 선), `up`(상승·매수 #C4262E), `down`(하락·매도 #1F4DB8)
- 글꼴: 제목·큰 숫자 `font-serif`(Noto Serif KR, black), 본문·표 `font-sans`(Noto Sans KR). 숫자는 tabular-nums, 한글은 `word-break: keep-all`
- 구조: 대제목 아래 `border-b-4 border-double border-ink`, 섹션 제목 아래 `border-b-2 border-ink`, 행 구분 `border-rule`. 둥근 모서리·그림자·그라디언트 사용 금지, 예전 emerald/gray 팔레트 사용 금지
- 버튼: 기본 `bg-ink text-paper`, 매수 `bg-up`, 매도 `bg-down`, 보조 `border border-ink`
- 화면 용어: 종목 목록=시세표, 주문 패널=주문서, 시작 폼=투자자 등록서, 분기 진행 버튼="다음 분기로"

## UI 표시 규칙

- **앱 이름**: shiftStocks (NavBar, SetupPage 로고)
- **뉴스 매체명**: AI Times (NewsPage 마스트헤드, NewsArticlePage 헤더)
- **거래 탭 종목 목록**: 한글 종목명 메인 (SSEI → 사성전자), 현재가 원 단위 (282,000원)
- **거래 탭 기본 필터**: 보유 종목 있으면 "보유 종목", 없으면 "전체" (분기마다 리셋)
- **거래 탭 기본 선택 종목**: 선택된 종목 없을 때 SSEI(사성전자) 자동 선택
- **홈 보유 종목**: 매수/매도 버튼 → `selectStock()` + navigate('/trade')
- **홈 게임 규칙 카드**: 게임 규칙 전문 + 3개 조건 실시간 달성 현황 (✓/✗)
- **종목 상세**: 한글명 대형 + 심볼 소형 서브텍스트
- **등락 색상**: 상승 빨강, 하락 파랑 (한국 증권 관례)
- **분기 표기**: `YEAR1 Q1`, `Y1Q1` (차트 라벨)
- **뉴스 페이지**: priceImpact·감성 지표·isSurprise 여부 사용자에게 일절 노출 금지
- **뉴스 페이지 배경**: 신문 용지색(`bg-paper`), NYT 스타일 레이아웃

---

## 뉴스 페이지 레이아웃 (`NewsPage.tsx`, `NewsArticlePage.tsx`)
- 배경 `bg-white`, 텍스트 `text-gray-900` 계열 (다크모드 아님)
- 마스트헤드: "AI Times" + "Q{n} 주요 소식" 부제목 + 이중 구분선
- 기사 8건을 **4열 × 2행 지면**으로 배치 (`lg` 4열, `md` 2열, 모바일 1열). 칸 사이는 세로선·가로선으로 구분. 각 칸: 섹터와 날짜, 헤드라인, 부제목, 기자명
- 모든 기사 제목 `text-[17px] font-black`(serif) 통일
- 기자명: `KOREAN_REPORTER_NAMES` 15명 목록에서 기사 인덱스로 배정

---

## Stocks (허구 종목 15개)

- **시작가는 무작위**: 표의 가격은 게임 시작 시점의 **현재가**이고, 시작가(`openPrice`)는 현재가의 ±10% 안에서 무작위로 정한다 (`buildInitialStocks`). 시작 전 구간의 무작위 차트와 등락률이 첫 화면부터 표시된다.
- 섹터당 3개 종목 (기술·교육·금융·물류·게임)


| 심볼 | 기업명 | 섹터 | 시작주가 |
|------|--------|------|---------|
| SSEI | 사성전자 | 기술 | ₩288,900 |
| CHOC | 초콜릿 | 기술 | ₩42,400 |
| SKYH | SKY 하이 | 기술 | ₩2,369,000 |
| MINC | aishift | 교육 | ₩18,900 |
| DKCD | 득코딩 | 교육 | ₩10,300 |
| CRZU | 크레이지 유니버스 | 교육 | ₩8,900 |
| DRBN | 두리은행 | 금융 | ₩115,700 |
| SSSN | 사성증권 | 금융 | ₩127,600 |
| NNBK | 너네은행 | 금융 | ₩29,600 |
| CPNG | 콘팡 | 물류 | ₩19,600 |
| NVRL | 네버라인 | 물류 | ₩25,700 |
| CHMK | 체리마켓 | 물류 | ₩210,000 |
| NEXT | 넥스트 | 게임 | ₩22,000 |
| MKSF | MK소프트 | 게임 | ₩297,000 |
| OBSD | 옵시디안 | 게임 | ₩43,200 |

---

## Rules
- All instructions on the final app must be in Korean.
- Do not assume. If you do not clearly understand what has been delegated to you, ask until you are clear.
- `useMarketSimulation`을 호출하지 말 것 — 턴제 게임이므로 실시간 틱이 없어야 한다.
