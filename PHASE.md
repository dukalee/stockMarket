# PHASE.md — MockMarket 단계별 구현 계획

PRD 기준. 각 Phase는 독립적으로 실행·검증 가능하도록 구성.

---

## PHASE 1 — 프로젝트 기반 세팅

**목표**: 앱이 뜨는 빈 껍데기 완성.

- [ ] `npm create vite@latest . -- --template react-ts`
- [ ] 패키지 설치: `zustand`, `recharts`, `lucide-react`, `react-router-dom`, `openai`
- [ ] Tailwind CSS v4 설치 및 `vite.config.ts` 플러그인 등록
- [ ] `src/index.css` → `@import "tailwindcss";`
- [ ] 불필요한 보일러플레이트 제거 (App.css, assets 등)
- [ ] `src/types/index.ts` — 전체 인터페이스 정의
- [ ] `src/utils/constants.ts` — 상수 정의

**검증**: `npm run dev` → 빈 화면 정상 렌더

---

## PHASE 2 — 데이터 레이어 (종목 + 스토어)

**목표**: 16개 종목 데이터와 3개 Zustand 스토어 구성.

- [ ] `src/data/stocks.ts` — 16개 허구 종목 초기값 (심볼, 이름, 섹터, 초기가, 변동성)
- [ ] `src/stores/gameStore.ts`
  - `userName`, `apiKey`, `dataFolderHandle`
  - `currentYear`, `currentQuarter`
  - `phase`: `'setup' | 'playing' | 'advancing'`
- [ ] `src/stores/marketStore.ts`
  - `stocks[]`, `currentNews[]`, `selectedStockId`
  - `tickAllPrices()`, `applyQuarterPriceChanges(impacts)`
- [ ] `src/stores/portfolioStore.ts`
  - `cash`, `positions`, `transactions`
  - `buyStock()`, `sellStock()` → `string | null`

**검증**: 브라우저 콘솔에서 스토어 상태 확인 가능

---

## PHASE 3 — 라우팅 & 공통 레이아웃

**목표**: 화면 간 이동 가능한 뼈대 완성.

- [ ] `src/App.tsx` — React Router 라우팅 설정
  ```
  /setup         → SetupPage
  /              → HomePage
  /trade         → TradePage
  /news          → NewsPage
  /news/:id      → NewsArticlePage
  ```
- [ ] 미설정(apiKey 없음) 시 `/setup` 리다이렉트 처리
- [ ] `src/components/layout/AppShell.tsx` — 다크 배경 + NavBar + children
- [ ] `src/components/layout/NavBar.tsx`
  - 좌: 로고 "MockMarket"
  - 중: Home / Trade / News 탭 링크
  - 우: 현재 분기 표시 (YEAR 1 - Q1) + **[진행하기]** 버튼

**검증**: 각 탭 클릭 시 라우트 전환, NavBar 고정 표시

---

## PHASE 4 — Setup 화면

**목표**: 게임 시작 전 초기 설정 완료.

- [ ] `src/pages/SetupPage.tsx`
  - 사용자명 입력 필드
  - OpenAI API Key 입력 필드 (password 타입)
  - 로컬 데이터 저장 폴더 선택 버튼 (`showDirectoryPicker()`)
  - [시작하기] 버튼 → `gameStore` 저장 → `/` 리다이렉트
- [ ] `src/hooks/useFileSystem.ts`
  - `pickDirectory()` — `showDirectoryPicker()` 래퍼
  - `saveJson(handle, filename, data)` — JSON 파일 저장

**검증**: 입력 후 [시작하기] 클릭 → Home 화면 진입

---

## PHASE 5 — Home 화면 (포트폴리오 대시보드)

**목표**: 현재 내 자산 현황을 한눈에 확인.

- [ ] `src/pages/HomePage.tsx`
- [ ] `src/components/portfolio/PortfolioSummary.tsx`
  - 총자산 / 현금 / 투자금 / 전체 손익 (금액 + %)
- [ ] `src/components/portfolio/HoldingsTable.tsx`
  - 보유 종목 목록: 심볼, 보유수량, 평균단가, 현재가, 평가손익
- [ ] `src/components/portfolio/TransactionHistory.tsx`
  - 거래내역 타임라인: 분기, 종목, 매수/매도, 수량, 금액

**검증**: 종목 매수 후 Home에서 반영 확인 (Phase 6 이후)

---

## PHASE 6 — Trade 화면 (종목 목록 + 차트 + 거래)

**목표**: 종목 조회 및 매수/매도 가능.

- [ ] `src/pages/TradePage.tsx`
- [ ] `src/components/market/StockList.tsx` — 16개 종목 목록
- [ ] `src/components/market/StockRow.tsx`
  - 심볼, 기업명, 섹터, 현재가, 분기 시작 대비 등락률 (색상)
- [ ] `src/components/market/StockDetail.tsx` — 선택 종목 우측 패널
- [ ] `src/components/market/PriceChart.tsx`
  - Recharts `AreaChart`, 분기 내 가격 히스토리
  - 현재가 > 분기시작가 → emerald gradient, 아니면 red
- [ ] `src/components/trading/TradeModal.tsx`
  - 매수 / 매도 탭
  - 수량 입력 → 예상 금액 실시간 계산
  - 잔금 부족 / 수량 초과 에러 표시
- [ ] `src/hooks/useMarketSimulation.ts`
  - `setInterval` 1초, `tickAllPrices()` 호출
  - 분기 내 소폭 noise (baseVolatility * 0.2)

**검증**: 종목 클릭 → 차트 표시 → 매수 → Home에서 포지션 확인

---

## PHASE 7 — News 화면 (AI 뉴스 생성)

**목표**: OpenAI가 생성한 분기 뉴스 카드 표시 + 기사 상세 페이지.

- [ ] `src/engines/newsEngine.ts`
  - `generateQuarterNews(apiKey, quarter, stocks, prevPrices)` → `NewsArticle[]`
  - OpenAI `gpt-4o-mini` 호출
  - 프롬프트: 16개 종목 현황 + 이전 분기 가격 변동 컨텍스트 제공
  - 응답: 5~7개 기사 (제목, 부제, 본문, 기자, 날짜, 관련종목, sentiment)
  - 숨겨진 `priceImpact: Record<symbol, number>` 함께 생성 (UI 미노출)
- [ ] `src/pages/NewsPage.tsx`
  - 뉴스 카드 그리드
- [ ] `src/components/news/NewsCard.tsx`
  - 헤드라인, 부제, 관련 종목 태그, 날짜, sentiment 색상 표시
  - 클릭 → `/news/:id`
- [ ] `src/pages/NewsArticlePage.tsx`
  - 뉴스 미디어 사이트 스타일
  - 로고 "MockMarket 타임스"
  - 헤드라인 / 부제 / 기자명·날짜 / 본문
  - 관련 종목 사이드바

**검증**: NewsPage에서 카드 확인 → 클릭 → 기사 상세 페이지 전환

---

## PHASE 8 — 분기 진행 (Quarter Advance)

**목표**: [진행하기] 버튼으로 분기 전환 + 가격 변동 적용.

- [ ] `src/engines/eventEngine.ts`
  - `computePriceChanges(news: NewsArticle[])` → `Record<symbol, number>`
  - 뉴스 `priceImpact` 합산 + ±5% 랜덤 noise 추가
- [ ] `src/hooks/useQuarterAdvance.ts`
  - `advanceQuarter()` 순서:
    1. `phase = 'advancing'` (UI 잠금)
    2. `applyQuarterPriceChanges(impacts)`
    3. `portfolioStore` 평가금액 갱신
    4. 로컬 파일 저장 (prices + news JSON)
    5. `currentQuarter++` (4 초과 시 `currentYear++`, `currentQuarter = 1`)
    6. `generateQuarterNews()` 호출 → `marketStore.currentNews` 갱신
    7. `phase = 'playing'`
- [ ] NavBar [진행하기] 버튼에 `advanceQuarter()` 연결
- [ ] 진행 중 로딩 스피너 표시 (뉴스 생성 대기 중)

**검증**: [진행하기] 클릭 → 로딩 → 가격 변동 확인 → 분기 표시 증가 → 새 뉴스 확인

---

## PHASE 9 — 로컬 파일 저장 ~~(스킵)~~

> 폴더 저장 기능 전체 제외 결정. 세션 인메모리만 사용.

---

## PHASE 10 — 마무리 & 품질

**목표**: 완성도 및 사용성 개선.

- [ ] 모든 UI 텍스트 한국어 확인
- [ ] 숫자 포맷: 원화 `₩1,234,567` / 퍼센트 `+12.34%`
- [ ] 에러 상태 처리
  - OpenAI API Key 오류 → Setup으로 리다이렉트 + 안내
  - 파일 저장 실패 → 토스트 알림
  - 잔금 부족 / 수량 초과 → 모달 내 에러 메시지
- [ ] 로딩 상태 처리
  - 뉴스 생성 중 → 스피너 + "뉴스를 가져오는 중..." 안내
- [ ] 빈 상태 처리
  - 보유 종목 없음 / 거래내역 없음 안내 문구
- [ ] TypeScript 타입 에러 0개 확인 (`npm run build`)

**검증**: 전체 게임 루프 1회 완주 (Setup → Q1 거래 → 진행 → Q2 뉴스 확인)

---

## 의존 관계

```
Phase 1 (기반)
  └→ Phase 2 (데이터)
       └→ Phase 3 (라우팅)
            ├→ Phase 4 (Setup)
            ├→ Phase 5 (Home)     ←── Phase 6 필요 (거래 후 검증)
            ├→ Phase 6 (Trade)
            └→ Phase 7 (News)
                 └→ Phase 8 (진행) ←── Phase 9 (파일저장) 포함
                      └→ Phase 10 (마무리)
```

Phase 1~3은 순차 필수. Phase 4~7은 병렬 진행 가능. Phase 8은 6·7 완료 후.
