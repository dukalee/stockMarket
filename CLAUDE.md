# MincoStocks (MockStockMarket)

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
| `src/engines/newsEngine.ts` | gpt-4.1-mini 뉴스 생성 — 2단계(Plan+Write) 구조 |
| `src/stores/gameStore.ts` | 게임 진행 상태 (year, quarter, phase, apiKey, adminAuth) |
| `src/stores/marketStore.ts` | 종목·뉴스·가격 상태. `lastFlipped`, `lastFlippedArticleId`, `newsLoadingProgress`(0~8) 포함 |
| `src/stores/portfolioStore.ts` | 현금·보유종목·거래내역·`prevQuarterPositions` 상태 |
| `src/hooks/useMarketSimulation.ts` | 실시간 틱 훅 — **사용 안 함** (의도적 미호출, 턴제 설계) |
| `src/hooks/useQuarterAdvance.ts` | 분기 진행 흐름. `{ advance, isAdvancing, advanceError }` 반환 |
| `src/pages/SetupPage.tsx` | 게임 시작화면. API 오류 시 에러 표시 후 진행 차단 |
| `src/pages/HomePage.tsx` | 포트폴리오 대시보드 + 게임 규칙 & 분기 조건 달성 현황 |
| `src/pages/TradePage.tsx` | 종목 목록·차트·매수매도 화면 |
| `src/pages/NewsPage.tsx` | MincoTimes 스타일 뉴스 목록 (white tone, NYT 레이아웃) |
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
| `src/components/trading/TradePanel.tsx` | 매수/매도 패널 — 당분기 매도 제한 없음 |
| `src/App.tsx` | 라우팅 구조 확인 |

---

## 게임 흐름

```
SetupPage
  유저명 + OpenAI API 키 입력
  → startGame() + initPortfolio()
  → generateQuarterNews(apiKey, 1, 1, stocks, onProgress)  ← Q1 뉴스 생성 (8단계 진행)
  → 실패 시: 에러 표시 + 진행 차단 (navigate 안 됨)
  → 성공 시: navigate('/')

playing 페이즈 (Q1)
  가격 고정 (틱 없음)
  사용자 거래 가능 (당분기 매수 종목도 자유롭게 매도 가능)

NavBar "Continue →" 클릭
  → 조건 미충족 시: 조건 모달 표시 (분기 진행 차단)
  → 충족 시: 확인 모달 → useQuarterAdvance.advance()
      1. computePriceChanges(currentNews)  ← 현재 분기 뉴스 impact 합산 + 반전 주사위
      2. applyQuarterPriceChanges(changes, "Y1Q1")  ← 가격 일괄 적용 + quarterLabel 기록
      3. snapshotPositions()  ← 현재 포트폴리오 스냅샷 저장 (다음 분기 비교용)
      4. nextQuarter()
      5. generateQuarterNews(apiKey, nextYear, nextQ, stocks, onProgress)
         실패 시: setNews([]) + advanceError 노출
      6. setPhase('playing')

  ※ 2번 직후 React 재렌더 → 차트에 분기 데이터 즉시 반영 (뉴스 생성 대기 중에도 차트 표시)
```

---

## 핵심 메커니즘

### 분기 가격 변동 (`eventEngine.ts`)
- 현재 분기 뉴스의 `priceImpact` 합산
- **반전(flip)**: 기사 순서대로 1d6 — 1이 나오면 해당 기사 impact 부호 반전. 첫 발동 후 이후 기사는 정상 적용. 분기당 최대 1회
- **±10% 균등 노이즈** 추가 (`NOISE_RANGE = 10`)
- `applyQuarterPriceChanges` 에서 `openPrice = 이전currentPrice` 로 보존 → 등락 기준선

### 뉴스 생성 (`newsEngine.ts`) — 2단계 구조
**모델**: `gpt-4.1-mini`, `temperature: 1.0`, `response_format: json_object`

**Phase 1 — Planning (1회 호출)**
- `PLANNER_SYSTEM_PROMPT` 사용
- 게임 메카닉 결정: `targetType`(global/local), `priceImpact`, `companyName`, `industry`, `event`, `sentiment`, `strength`, `isSurprise`
- 분기당 정확히 8개 이벤트 설계. 8개 미만 시 1회 재시도
- `max_tokens: 4096`

**Phase 2 — Writing (8회 병렬 호출 — Promise.all)**
- `WRITER_SYSTEM_PROMPT` 사용 (공통 금지사항 + 수치 필수 포함)
- 기사별 강도(`strength`)와 반전 여부(`isSurprise`)에 따라 다른 스타일 가이드 주입
- 기자명: `KOREAN_REPORTER_NAMES` 15명 목록에서 인덱스 순으로 배정
- 날짜: 분기 범위 내 서로 다른 날짜 지시
- 기사 완성 시마다 `onProgress(++completedCount)` 호출 → 0~8 진행률 (완료 순 비순차)
- `max_tokens: 2048`

**기사 강도 배분 (분기당 고정 구성)**
| 구성 | 강도 | priceImpact 범위 |
|------|------|----------------|
| 1개 | 약간 부정 (slight bearish) | -5 ~ +5% |
| 1개 | 부정 (moderate bearish) | -5 ~ -10% |
| 1개 | 매우 부정 (strong bearish) | -15 ~ -25% |
| 1개 | 약간 긍정 (slight bullish) | -5 ~ +5% |
| 1개 | 긍정 (moderate bullish) | +5 ~ +10% |
| 1개 | 매우 긍정 (strong bullish) | +15 ~ +25% |
| 2개 | 랜덤 | 위 6가지 중 자유 선택 |

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

### 차트 (`PriceChart.tsx`) — 순수 SVG 캔들스틱
- Recharts 제거, ResizeObserver 기반 순수 SVG 렌더링
- **분기당 100개 미니캔들** (`STEPS = 100`)
- **Brownian bridge 보간**: `stepVol = priceMid * 0.07 / sqrt(steps)` — 가격 레벨 기준 변동성, 조용한 분기도 자연스러운 등락 표현
- 각 미니캔들: open/close = 연속 보간 포인트, high/low = seeded 노이즈 wick
- 하단 18%: 거래량 바 (seeded 허구값, 상승=연한 빨강, 하락=연한 파랑)
- 분기 경계: 수직 점선 구분선 + X축 라벨 (`Y1Q1` 등)
- 호버 툴팁: 시가/종가/고가/저가/등락% 표시
- Q1 미진행 시: "분기를 진행하면 차트가 표시됩니다" 메시지

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
- 당분기 매수 종목도 **자유롭게 매도 가능**
- 단, 매수 후 전량 매도한 종목은 분기 매수 조건 카운트에서 제외 (보유 수량 > 0 인 종목만 카운트)

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

**전체 종목 예상 변동 순위** — 20개 전종목 (0.0% 포함)

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
| `gameStore` | `userName`, `apiKey`, `initialCapital`, `currentYear`, `currentQuarter`, `phase`(setup/playing/advancing), `adminAuth` |
| `marketStore` | `stocks[]`, `currentNews[]`, `newsLoading`, `newsLoadingProgress`(0~8 기사수), `lastFlipped`, `lastFlippedArticleId` |
| `portfolioStore` | `cash`, `positions{}`, `transactions[]`, `prevQuarterPositions{}` |

---

## 에러 처리

| 위치 | 동작 |
|------|------|
| `SetupPage` Q1 뉴스 실패 | 에러 메시지 표시 + `navigate('/')` 차단. 사용자가 API 키 수정 후 재시도 가능 |
| `useQuarterAdvance` 뉴스 실패 | `setNews([])` + `advanceError` 상태 노출 → NavBar 빨간 배너 표시. Admin 대시보드에서 "뉴스 다시 생성" 가능 |

---

## UI 표시 규칙

- **앱 이름**: MincoStocks (NavBar, SetupPage 로고)
- **뉴스 매체명**: MincoTimes (NewsPage 마스트헤드, NewsArticlePage 헤더)
- **거래 탭 종목 목록**: 한글 종목명 메인 (SSEI → 사성전자), 현재가 원 단위 (282,000원)
- **거래 탭 기본 필터**: 보유 종목 있으면 "보유 종목", 없으면 "전체" (분기마다 리셋)
- **거래 탭 기본 선택 종목**: 선택된 종목 없을 때 SSEI(사성전자) 자동 선택
- **홈 보유 종목**: 매수/매도 버튼 → `selectStock()` + navigate('/trade')
- **홈 게임 규칙 카드**: 게임 규칙 전문 + 3개 조건 실시간 달성 현황 (✓/✗)
- **종목 상세**: 한글명 대형 + 심볼 소형 서브텍스트
- **등락 색상**: 상승 빨강, 하락 파랑 (한국 증권 관례)
- **분기 표기**: `YEAR1 Q1`, `Y1Q1` (차트 라벨)
- **뉴스 페이지**: priceImpact·감성 지표·isSurprise 여부 사용자에게 일절 노출 금지
- **뉴스 페이지 배경**: 흰색 (white tone), NYT 스타일 레이아웃

---

## 뉴스 페이지 레이아웃 (`NewsPage.tsx`, `NewsArticlePage.tsx`)
- 배경 `bg-white`, 텍스트 `text-gray-900` 계열 (다크모드 아님)
- 마스트헤드: "MincoTimes" + "Q{n} 주요 소식" 부제목 + 이중 구분선
- 기사 행: `[날짜 컬럼 w-20] [섹터 · 헤드라인 · 부제목 · 기자명]`
- 모든 기사 제목 `text-sm font-bold` 통일
- 기자명: `KOREAN_REPORTER_NAMES` 15명 목록에서 기사 인덱스로 배정

---

## Stocks (허구 종목 20개)

| 심볼 | 기업명 | 섹터 | 시작주가 |
|------|--------|------|---------|
| SSEI | 사성전자 | 기술 | ₩288,900 |
| MRCE | 미래자동차 | 기술 | ₩741,000 |
| CHOC | 초콜릿 | 기술 | ₩42,400 |
| SKYH | SKY 하이 | 기술 | ₩2,369,000 |
| GLES | 굿럭전자 | 기술 | ₩372,500 |
| MINC | 민코딩 | 교육 | ₩18,900 |
| DKCD | 득코딩 | 교육 | ₩10,300 |
| SGCP | 싱글캠퍼스 | 교육 | ₩25,000 |
| CRZU | 크레이지 유니버스 | 교육 | ₩8,900 |
| DRBN | 두리은행 | 금융 | ₩115,700 |
| SSSN | 사성증권 | 금융 | ₩127,600 |
| NNBK | 너네은행 | 금융 | ₩29,600 |
| GKMN | 국민금융 | 금융 | ₩153,100 |
| CPNG | 콘팡 | 물류 | ₩19,600 |
| NVRL | 네버라인 | 물류 | ₩25,700 |
| CHMK | 체리마켓 | 물류 | ₩210,000 |
| NEXT | 넥스트 | 게임 | ₩22,000 |
| MKSF | MK소프트 | 게임 | ₩297,000 |
| OBSD | 옵시디안 | 게임 | ₩43,200 |
| GRUP | 기어업 | 게임 | ₩29,100 |

---

## Rules
- All instructions on the final app must be in Korean.
- Do not assume. If you do not clearly understand what has been delegated to you, ask until you are clear.
- `useMarketSimulation`을 호출하지 말 것 — 턴제 게임이므로 실시간 틱이 없어야 한다.
