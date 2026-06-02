# PLAN.md — PHASE 8: 분기 진행 (Quarter Advance)

## 목표
[다음 분기로 진행 →] 버튼 클릭 시:
1. 현재 분기 뉴스의 `priceImpact`를 종목 가격에 반영
2. 분기 카운터 증가
3. 다음 분기 뉴스 자동 생성
4. 전 과정 동안 UI 잠금 (매수/매도 비활성화)

---

## 현재 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| `eventEngine.ts` | ❌ 미생성 | priceImpact 합산 + noise 계산 |
| `useQuarterAdvance.ts` | ❌ 미생성 | 진행 흐름 전체 관리 |
| NavBar [진행하기] 연결 | ❌ 미연결 | `onAdvance` prop 미배선 |
| `AppShell` 에 `onAdvance` 전달 | ❌ 미연결 | 각 페이지에서 hook 호출 필요 |

---

## 체크리스트

### 1. `src/engines/eventEngine.ts` — 가격 변동 계산

```ts
import type { NewsArticle } from '../types'

const NOISE_RANGE = 5  // ±5%

// Box-Muller 기반 정규분포 noise (너무 극단적이지 않게)
function gaussianNoise(range: number): number {
  const u = 1 - Math.random()
  const v = 1 - Math.random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return (z / 3) * range  // 3-sigma 내 클리핑
}

export function computePriceChanges(
  news: NewsArticle[]
): Record<string, number> {
  // 1. 뉴스별 priceImpact 합산
  const base: Record<string, number> = {}
  for (const article of news) {
    for (const [symbol, pct] of Object.entries(article.priceImpact)) {
      base[symbol] = (base[symbol] ?? 0) + pct
    }
  }

  // 2. 종목별 랜덤 noise 추가
  const result: Record<string, number> = {}
  for (const [symbol, impact] of Object.entries(base)) {
    result[symbol] = impact + gaussianNoise(NOISE_RANGE)
  }

  return result
}
```

---

### 2. `src/hooks/useQuarterAdvance.ts` — 진행 흐름

```ts
export function useQuarterAdvance() {
  const { apiKey, currentYear, currentQuarter, phase, setPhase, nextQuarter } = useGameStore()
  const { stocks, currentNews, applyQuarterPriceChanges, setNews, setNewsLoading } = useMarketStore()

  const isAdvancing = phase === 'advancing'

  const advance = async () => {
    if (isAdvancing) return

    // 1. UI 잠금
    setPhase('advancing')
    setNewsLoading(true)

    // 2. priceImpact 계산 + 가격 적용
    const impacts = computePriceChanges(currentNews)
    applyQuarterPriceChanges(impacts)

    // 3. 분기 카운터 증가
    nextQuarter()

    // 4. 다음 분기 뉴스 생성
    // nextQuarter() 이후 값 읽기: 스토어 직접 접근
    const nextYear    = useGameStore.getState().currentYear
    const nextQuarterN = useGameStore.getState().currentQuarter

    try {
      const news = await generateQuarterNews(apiKey, nextYear, nextQuarterN, stocks)
      setNews(news)
    } catch {
      setNews([])
    }

    // 5. UI 잠금 해제
    setNewsLoading(false)
    setPhase('playing')
  }

  return { advance, isAdvancing }
}
```

**stale closure 주의**: `nextQuarter()` 호출 후 분기값은 `useGameStore.getState()`로 직접 읽는다.  
(hook 구독 값은 리렌더 전까지 이전 값을 가리킴)

---

### 3. `AppShell` 에 `onAdvance` 배선

각 페이지(`HomePage`, `TradePage`, `NewsPage`)에서 `useQuarterAdvance`를 호출하고 `AppShell`에 전달한다.

```tsx
// 예: HomePage.tsx
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'

export default function HomePage() {
  const { advance, isAdvancing } = useQuarterAdvance()

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance}>
      ...
    </AppShell>
  )
}
```

`TradePage`, `NewsPage` 동일하게 적용.

---

### 4. `applyQuarterPriceChanges` 수정 확인

현재 `marketStore`의 구현:
```ts
applyQuarterPriceChanges: (impacts) =>
  set(state => ({
    stocks: state.stocks.map(stock => {
      const factor   = 1 + (impacts[stock.id] ?? 0) / 100
      const newPrice = Math.max(1, Math.round(stock.currentPrice * factor))
      return {
        ...stock,
        currentPrice: newPrice,
        openPrice:    newPrice,       // 다음 분기 기준가 = 변동 후 가격
        high: newPrice, low: newPrice, volume: 0,
        priceHistory: [...stock.priceHistory, { timestamp: Date.now(), price: newPrice }],
      }
    }),
  }))
```

`priceHistory`에 분기별 데이터 포인트가 **누적** 됨 → PriceChart 분기 차트 자동 반영.  
`impacts`에 없는 종목 (`?? 0`) → 가격 유지.

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|------|-----------|
| `src/engines/eventEngine.ts` | 신규 생성 |
| `src/hooks/useQuarterAdvance.ts` | 신규 생성 |
| `src/pages/HomePage.tsx` | 수정 — `useQuarterAdvance` 추가, AppShell에 전달 |
| `src/pages/TradePage.tsx` | 수정 — 동일 |
| `src/pages/NewsPage.tsx` | 수정 — 동일 |

---

## 진행 중 UI 상태

| 컴포넌트 | `isAdvancing === true` 시 동작 |
|----------|-------------------------------|
| NavBar [진행하기] 버튼 | 스피너 + "뉴스 생성 중..." 비활성화 |
| TradePanel 매수/매도 버튼 | `disabled` — `StockDetail`에 `isAdvancing` 전달됨 |
| NewsPage 카드 | 클릭 가능 유지 (읽기 전용) |

---

## 검증 기준
- [ ] [진행하기] 클릭 → NavBar 버튼 비활성화 + 스피너
- [ ] 가격이 뉴스 `priceImpact` 기반으로 변동
- [ ] 분기 표시 증가 (Q1 → Q2, Q4 → YEAR 2 Q1)
- [ ] PriceChart에 새 분기 막대 추가 확인
- [ ] 뉴스 탭에 다음 분기 AI 생성 뉴스 표시
- [ ] 진행 중 매수/매도 버튼 비활성화
- [ ] Admin 대시보드에 새 분기 뉴스 반영
- [ ] `npm run build` 타입 에러 0개
