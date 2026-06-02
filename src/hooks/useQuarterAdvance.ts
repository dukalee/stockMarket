import { useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useMarketStore } from '../stores/marketStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { computePriceChanges } from '../engines/eventEngine'
import { generateQuarterNews } from '../engines/newsEngine'

export function useQuarterAdvance() {
  const phase       = useGameStore(s => s.phase)
  const setPhase    = useGameStore(s => s.setPhase)
  const nextQuarter = useGameStore(s => s.nextQuarter)
  const apiKey      = useGameStore(s => s.apiKey)

  const currentNews              = useMarketStore(s => s.currentNews)
  const applyQuarterPriceChanges = useMarketStore(s => s.applyQuarterPriceChanges)
  const setNews                  = useMarketStore(s => s.setNews)
  const setNewsLoading           = useMarketStore(s => s.setNewsLoading)
  const setNewsLoadingProgress   = useMarketStore(s => s.setNewsLoadingProgress)
  const setDiceResult            = useMarketStore(s => s.setDiceResult)

  const isAdvancing = phase === 'advancing'
  const [advanceError, setAdvanceError] = useState<string | null>(null)

  const advance = async () => {
    if (isAdvancing) return

    setAdvanceError(null)
    setPhase('advancing')
    setNewsLoading(true)
    setNewsLoadingProgress(0)

    // 1. 현재 뉴스 priceImpact → 위험 요소 주사위 포함 가격 변동 계산 + 적용
    const { changes, flipped, flippedArticleId } = computePriceChanges(currentNews)
    const flippedArticle = flippedArticleId
      ? currentNews.find(a => a.id === flippedArticleId) ?? null
      : null
    setDiceResult(flipped, flippedArticle)
    const endingYear = useGameStore.getState().currentYear
    const endingQ    = useGameStore.getState().currentQuarter
    applyQuarterPriceChanges(changes, `Y${endingYear}Q${endingQ}`)

    // 2. 이번 분기 종료 시점 포트폴리오 스냅샷 → 다음 분기 비교 기준
    usePortfolioStore.getState().snapshotPositions()

    // 3. 분기 카운터 증가
    nextQuarter()

    // 3. stale closure 방지: 스토어에서 직접 읽기
    const nextYear = useGameStore.getState().currentYear
    const nextQ    = useGameStore.getState().currentQuarter

    // 4. 다음 분기 뉴스 생성 — 기사 완성 시마다 progress 업데이트 (0~8)
    try {
      const stocks = useMarketStore.getState().stocks
      const news = await generateQuarterNews(apiKey, nextYear, nextQ, stocks, setNewsLoadingProgress)
      setNews(news)
    } catch (err) {
      setNews([])
      const msg = err instanceof Error ? err.message : '알 수 없는 오류'
      setAdvanceError(`뉴스 생성 실패 — ${msg}`)
    }

    setNewsLoadingProgress(8)
    setNewsLoading(false)
    setPhase('playing')
    setTimeout(() => setNewsLoadingProgress(0), 400)

    // 분기 전환 결과 팝업 데이터 저장
    useGameStore.getState().setQuarterResult({
      endingYear,
      endingQuarter: endingQ,
      newYear: nextYear,
      newQuarter: nextQ,
      changes,
    })
  }

  return { advance, isAdvancing, advanceError }
}
