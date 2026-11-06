# PRD — MockStockMarket

**분기 단위 턴제 가상 주식 거래 시뮬레이터**  
React + Vite + TypeScript · GPT-4o 뉴스 생성 · 한국 증권 UI 관례

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 장르 | 턴제 주식 시뮬레이션 게임 |
| 플랫폼 | 웹 브라우저 (SPA) |
| 진행 단위 | 분기 (Q1~Q4, 연 단위 반복) |
| 초기 자본 | ₩10,000,000 |
| 뉴스 생성 | OpenAI GPT-4o (사용자 API 키 입력) |
| 실시간 틱 | **없음** — 가격은 분기 진행 시에만 변동 |

---

## 2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프레임워크 | React 18 + Vite |
| 언어 | TypeScript |
| 상태 관리 | Zustand (3개 스토어) |
| 라우팅 | React Router v6 |
| 스타일 | Tailwind CSS (다크 테마 고정) |
| AI 연동 | OpenAI SDK (`gpt-4o`, 브라우저 직접 호출) |
| 차트 | 커스텀 SVG 캔들 차트 (PriceChart.tsx) |

---

## 3. 게임 흐름

```
[SetupPage]
  유저명 + OpenAI API 키 입력
  → startGame() + initPortfolio()
  → generateQuarterNews(Q1) 호출
      ├─ 실패: 에러 표시 + 진행 차단 (navigate 안 됨)
      └─ 성공: navigate('/')

[playing 페이즈]
  가격 고정 (틱 없음)
  사용자 자유 거래

[NavBar "다음 분기로 진행" 클릭]
  → useQuarterAdvance.advance()
      1. computePriceChanges(currentNews)
         └─ 기사별 priceImpact 합산 + 반전(flip) 주사위
      2. applyQuarterPriceChanges(changes, "Y1Q1")
         └─ 가격 일괄 적용 + quarterLabel 기록
      3. nextQuarter()  (Q4→다음 연도 Q1)
      4. generateQuarterNews(nextYear, nextQ)
         ├─ 실패: setNews([]) + advanceError 배너 표시
         └─ 성공: 새 분기 뉴스 세팅
      5. setPhase('playing')

  ※ 2번 직후 React 재렌더 → 차트 즉시 반영 (뉴스 생성 대기 중에도)
```

---

## 4. 페이지 구성

### 4-1. SetupPage `/setup`

- 유저명 입력 (텍스트)
- OpenAI API 키 입력 (비밀번호 마스킹)
- "시작하기" 클릭 시 Q1 뉴스 생성 시도
- 뉴스 생성 실패 시 에러 메시지 표시 + navigate 차단
- 성공 시 HomePage로 이동

### 4-2. HomePage `/`

포트폴리오 대시보드

| 영역 | 내용 |
|------|------|
| 상단 카드 4개 | 총 자산 / 보유 현금 / 투자금 / 전체 수익률 |
| 보유 종목 테이블 | 심볼·한글명·보유주수·평가손익 + **매수/매도 버튼** |
| 거래 내역 목록 | 분기·종목·매수매도·수량·금액 |

**보유 종목 테이블 — 매수/매도 버튼**
- 각 행 우측에 빨간 `매수` / 파란 `매도` 버튼
- 클릭 시 해당 종목을 `selectStock()` 선택 후 `/trade`로 이동

### 4-3. TradePage `/trade`

2단 레이아웃 (좌: 종목 목록 / 우: 종목 상세)

**좌측 종목 사이드바**
- 필터 드롭다운: `보유 종목 | 전체 | 기술 | 교육 | 금융 | 물류 | 게임`
  - `보유 종목` 선택 시 현재 포지션이 있는 종목만 표시
  - 분기 시작(`currentYear`/`currentQuarter` 변경) 시 보유 종목이 있으면 자동으로 "보유 종목" 기본 선택
  - 보유 종목 없으면 "전체" 기본 선택
- `StockList` → `StockRow` (2줄 레이아웃)
  - 1줄: 한글 종목명 메인
  - 2줄: 심볼 소형 + 현재가(원 단위) + 등락률

**우측 종목 상세**
- 한글명 대형 + 심볼 소형 서브텍스트
- 분기 시작가 대비 등락 표시
- `PriceChart` — 분기별 캔들 차트
  - Q1 (분기 진행 전): "분기를 진행하면 차트가 표시됩니다" 메시지
  - 분기 진행 후: 분기별 캔들 + 구간 보간 파동
- 매수 패널 / 매도 패널 (`TradePanel`)
  - 수량 입력 → 예상 금액 실시간 계산
  - advancing 페이즈: 버튼 비활성화
  - **당분기 매수 종목 매도 제한**: 이번 분기에 매수한 종목은 같은 분기 내 매도 불가
    - 매도 버튼 `disabled` + "이번 분기에 매수한 종목은 같은 분기에 매도할 수 없습니다." 경고 표시
    - 매수 확인 팝업에 "⚠ 이번 분기에 매수한 주식은 같은 분기 내 매도가 불가능합니다." 안내 문구 항상 표시

### 4-4. NewsPage `/news`

사용자용 뉴스 목록 (priceImpact·감성 정보 **일절 비노출**)

- 분기 표기 + 총 기사 수
- 카드 그리드: 날짜·기자명·헤드라인·본문 2~3줄 발췌
- "기사 읽기 →" 링크

### 4-5. NewsArticlePage `/news/:id`

- MockMarket 타임스 헤더
- 헤드라인 + 부제목 + 기자/날짜 + 본문 전체
- "← 뉴스 목록으로 돌아가기" 링크
- **미노출**: 관련 종목 사이드바, 가격 영향, 감성 지표

### 4-6. AdminLoginPage `/admin`

- 관리자 키 입력 (서버가 검사한다)
- 오류 시 에러 메시지 표시

### 4-7. AdminDashboardPage `/admin/dashboard` — ※ 제거됨 (관리자 화면은 대회 관리만 한다. 기록용으로만 남김)

관리자 전용. 탭 구성: **요약 / 기술 / 교육 / 금융 / 물류 / 게임 / 뉴스**

#### 요약 탭

**① 위험 요소 배너**

분기 진행 이후 표시. 두 가지 상태:
- 미발동: "위험 요소 미발동 — 전 기사 정상 적용"
- 발동 시:
  - "위험 요소 발동! — 기사 1건 영향 반전" 헤더
  - 반전 기사 제목 표시
  - 영향받는 각 종목을 칩으로 나열: `심볼 한글명 원래% → 반전%` (취소선 + 화살표)
  - 하단: "기사별 1/6 확률 · 첫 발동 시 종료"

**② 투자 조언**

기사 합산 기준값 기준 (±8% noise 미적용). 세 단락 구성:

| 단락 | 내용 |
|------|------|
| ① 강세 분야 | sectorImpact > 2% 섹터 목록 + 대표 기사 헤드라인 |
| ② 약세 분야 | sectorImpact < -2% 섹터 목록 + 대표 기사 헤드라인 |
| ③ 추천 종목 Top 5 | 상승 예상 상위 5개 · 예상 변동률 · 근거 기사 헤드라인 |

**③ 전체 종목 예상 변동 순위**

- 20개 종목 전체 (영향 없는 종목도 0.0% 표기)
- 열: 심볼 / 기업명 / 섹터 / 현재가 / 예상가 / 예상 변동

**④ 분기 뉴스 종합**

각 기사별:
- 카테고리 배지: `글로벌 · 섹터명` 또는 `로컬 종목` (색상 구분)
- 영향 종목 인라인: `심볼 ±X.X%` (5개 초과 시 `+N개`)
- 헤드라인
- summary (admin 전용 1~2줄 요약) — 좌측 보더 라인으로 근거 형식 표시
- 우측: 평균 priceImpact %

#### 섹터 탭 (기술/교육/금융/물류/게임)

- 탭 버튼에 섹터 영향도 % 실시간 표시
- 전체 영향 행: 글로벌 기사 합산 impact + 해당 기사 헤드라인 목록
- 종목 행: 직접 영향 기사만 표시 (글로벌 제외), 우측에 `전체+종목=합산` 분해

#### 뉴스 탭

- 기사별 카드: 헤드라인 + 감성 배지 (긍정↑/부정↓/중립→) + summary + 영향 종목 칩

#### 공통 기능

- "뉴스 다시 생성" 버튼 (뉴스 없을 때)
- 로그아웃 버튼 (adminAuth 해제)
- 분기 진행 버튼 + advanceError 배너 (NavBar 경유)

---

### 4-8. NavBar — 분기 매수 조건 시스템

분기 진행 버튼 옆에 진척도 배지와 조건 검사 모달이 포함됨.

**매수 조건** (`REQUIRED_STOCKS = 3`, `REQUIRED_SECTORS = 2`)
- 이번 분기에 **서로 다른 종목 3개 이상** 매수
- 이번 분기에 **서로 다른 섹터 2개 이상** 에서 매수
- 같은 종목 중복 매수는 1회로 카운트 (`Set`으로 중복 제거)
- `phase !== 'playing'` 구간(advancing, setup)은 조건 검사 생략

**진척도 배지** (NavBar 우측, `phase === 'playing'`일 때 상시 표시)
- 형식: `N/3 종목 · N/2 섹터`
- 조건 미충족: 노란색 / 충족: 초록색
- 클릭 시 조건 모달 열림

**진행 버튼 상태**
- 조건 충족: 초록 "다음 분기로 진행 →" → 분기 진행 확인 모달
- 조건 미충족: 노란 "🛡 조건 미충족" → 조건 안내 모달 (분기 진행 차단)
- advancing 중: 회색 스피너 + 진행률 %

**조건 안내 모달**
- 달성 종목 심볼 배지 목록 (`N / 3`)
- 달성 섹터 배지 목록 (`N / 2`)
- 조건 충족 시 제목 "분기 매수 조건 달성"으로 변경 (클릭 접근 가능)

---

## 5. 핵심 엔진

### 5-1. eventEngine.ts — 분기 가격 변동

```
computePriceChanges(news: NewsArticle[]): PriceChangeResult
```

1. 기사별 priceImpact 합산 (기본)
2. **반전(flip) 주사위**: 기사 순서대로 1d6 — 1이 나오면 해당 기사 impact 부호 반전  
   · 첫 발동 후 이후 기사는 주사위 없이 정상 합산  
   · 분기당 최대 1회 발동
3. 종목별 합산값에 균등 노이즈 ±8% 추가
4. 반환: `{ changes, flipped, flippedArticleId }`

### 5-2. newsEngine.ts — GPT-4o 뉴스 생성

```
generateQuarterNews(apiKey, year, quarter, stocks): Promise<NewsArticle[]>
```

| 파라미터 | 값 |
|----------|-----|
| 모델 | `gpt-4o` |
| max_tokens | 16,384 |
| temperature | 1.0 |
| response_format | `json_object` |
| 분기당 기사 수 | 8개 (미달 시 1회 재시도) |

**기사 구성 규칙**
- global / local 50:50 비율
- 이벤트 타입: earnings·contract·rumor·correction·policy·macro·accident
- 주사위(1~6)로 priceImpact 범위 결정: ±0~5% / ±5~10% / ±10~20%
- global: 섹터 전체 종목에 동일 방향 impact
- local: 종목 1개에만 impact
- 헤드라인에 방향성 단어 금지 (상승/하락/기대/전망 등)
- 부제목은 상반된 해석 2가지 병치 필수
- 본문 1,000자 이상, 구체적 수치·인용문 포함

### 5-3. priceEngine.ts — GBM (현재 미사용)

Geometric Brownian Motion 기반 가격 생성 함수. 턴제 설계상 호출하지 않음.  
`useMarketSimulation` 훅도 동일 이유로 미호출.

---

## 6. 차트 (`PriceChart.tsx`)

- `priceHistory`에서 `quarterLabel` 있는 포인트만 필터링 → 분기당 캔들 1개
- 분기 간 구간: `seededWave(from, to, 24steps, seed)` — 4중 조화 파동 결정론적 보간
- 상승 구간: 빨강(`#ef4444`) / 하락 구간: 파랑(`#3b82f6`)
- 게임 시작가 마커 (회색 원) + 수평 점선 기준선

---

## 7. 스토어 구조

### gameStore

| 상태 | 타입 | 설명 |
|------|------|------|
| `userName` | string | 플레이어명 |
| `apiKey` | string | OpenAI API 키 |
| `initialCapital` | number | 게임 시작 자본 |
| `currentYear` | number | 현재 연도 (1~) |
| `currentQuarter` | number | 현재 분기 (1~4) |
| `phase` | `setup\|playing\|advancing` | 게임 페이즈 |
| `adminAuth` | boolean | 관리자 인증 여부 |

### marketStore

| 상태 | 타입 | 설명 |
|------|------|------|
| `stocks[]` | Stock[] | 20개 종목 전체 |
| `currentNews[]` | NewsArticle[] | 현재 분기 뉴스 |
| `newsLoading` | boolean | 뉴스 생성 중 여부 |
| `newsLoadingProgress` | number | 0~100, 페이크 프로그레스 바 |
| `selectedStockId` | string\|null | 거래 화면 선택 종목 |
| `lastFlipped` | boolean | 마지막 분기 반전 발동 여부 |
| `lastFlippedArticleId` | string\|null | 반전된 기사 ID |

### portfolioStore

| 상태 | 타입 | 설명 |
|------|------|------|
| `cash` | number | 보유 현금 |
| `positions{}` | Record<string, Position> | 종목별 보유 현황 |
| `transactions[]` | Transaction[] | 전체 거래 내역 |

---

## 8. 데이터 타입

```ts
interface NewsArticle {
  id: string
  quarter: string           // "YEAR1-Q1"
  headline: string
  subheadline: string
  body: string
  summary: string           // 1~2줄 핵심 요약 (admin 전용)
  author: string
  publishedAt: string
  affectedSymbols: string[]
  sentiment: 'bullish' | 'bearish' | 'neutral'
  priceImpact: Record<string, number>
  targetType: 'global' | 'local'
  targetSector?: string
}

interface PricePoint {
  timestamp: number
  price: number
  quarterLabel?: string     // "Y1Q1" — applyQuarterPriceChanges 시점에만 존재
}
```

---

## 9. 종목 목록 (20개)

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

## 10. UI/UX 규칙

| 항목 | 규칙 |
|------|------|
| 언어 | 모든 UI 텍스트 한국어 |
| 테마 | 다크 고정 (배경 `gray-950` 계열) |
| 등락 색상 | 상승 빨강, 하락 파랑 (한국 증권 관례) |
| 가격 표시 | 원 단위 (₩282,000 형식) |
| 종목명 | 한글명 메인, 심볼 서브 |
| 분기 표기 | NavBar: `YEAR1 · Q1`, 차트 라벨: `Y1Q1` |
| 실시간 틱 | `useMarketSimulation` 훅 존재하나 미호출 (의도적) |

---

## 11. 에러 처리

| 위치 | 트리거 | 동작 |
|------|--------|------|
| SetupPage | Q1 뉴스 생성 실패 | 에러 메시지 표시 + navigate 차단 |
| useQuarterAdvance | 분기 진행 중 뉴스 실패 | `setNews([])` + NavBar 빨간 배너 (`advanceError`) |
| AdminDashboard | 뉴스 없음 상태 | "뉴스 다시 생성" 버튼 노출 + 재시도 가능 |

---

## 12. 파일 참조 가이드

| 파일 | 용도 |
|------|------|
| `src/types/index.ts` | 전체 타입·인터페이스 |
| `src/utils/constants.ts` | 게임 상수 (초기 자본, 분기 설정 등) |
| `src/data/stocks.ts` | 종목 초기 데이터 |
| `src/engines/eventEngine.ts` | 분기 가격 계산 + 반전 주사위 |
| `src/engines/newsEngine.ts` | GPT-4o 뉴스 생성 |
| `src/engines/priceEngine.ts` | GBM 함수 (미사용) |
| `src/stores/gameStore.ts` | 게임 진행 상태 |
| `src/stores/marketStore.ts` | 종목·뉴스·가격 상태 |
| `src/stores/portfolioStore.ts` | 현금·보유종목·거래내역 |
| `src/hooks/useQuarterAdvance.ts` | 분기 진행 플로우 |
| `src/hooks/useMarketSimulation.ts` | 실시간 틱 훅 (미사용) |
| `src/pages/SetupPage.tsx` | 게임 시작화면 |
| `src/pages/HomePage.tsx` | 포트폴리오 대시보드 |
| `src/pages/TradePage.tsx` | 종목 목록·차트·매수매도 |
| `src/pages/NewsPage.tsx` | 뉴스 카드 목록 |
| `src/pages/NewsArticlePage.tsx` | 뉴스 기사 상세 |
| `src/pages/AdminLoginPage.tsx` | 관리자 로그인 |
| `src/pages/AdminDashboardPage.tsx` | 관리자 대시보드 |
| `src/components/layout/NavBar.tsx` | 네비게이션 + 분기 진행 버튼 |
| `src/components/layout/AppShell.tsx` | 공통 레이아웃 래퍼 |
| `src/components/market/StockList.tsx` | 종목 사이드바 · 보유 종목 필터 · 분기 시작 자동 필터 |
| `src/components/market/StockRow.tsx` | 종목 행 (2줄 레이아웃) |
| `src/components/market/StockDetail.tsx` | 종목 상세 패널 |
| `src/components/market/PriceChart.tsx` | 분기별 캔들 차트 |
| `src/components/portfolio/HoldingsTable.tsx` | 보유 종목 테이블 · 행별 매수/매도 버튼 |
| `src/components/trading/TradePanel.tsx` | 매수/매도 패널 · 당분기 매수 종목 매도 제한 |
| `src/App.tsx` | 라우팅 구조 |
