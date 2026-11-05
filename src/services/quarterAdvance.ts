import { useGameStore, quarterIndexOf, penaltyRateOf } from '../stores/gameStore'
import { useMarketStore } from '../stores/marketStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useContestRoundStore } from '../stores/contestRoundStore'
import { computePriceChanges } from '../engines/eventEngine'
import { generateQuarterNews } from '../engines/staticNewsEngine'
import { createRng } from '../utils/seededRandom'
import { syncContestScore } from './contestSync'
import { finishRound, getRoundState } from './contest'

/**
 * 한 분기를 마감하고 다음 분기로 넘어간다.
 *  - 시뮬레이션: 사용자가 "다음 분기로"를 누르면 호출된다.
 *  - 대회: 서버가 라운드를 넘겼을 때(전원 마감 또는 제한시간 초과) useContestSync 가 호출한다.
 *    마감하지 못해 서버가 페널티를 표시한 분기라면, 가격 변동을 적용하기 전에 현금·주식의 일부를 차감한다.
 */
export async function advanceQuarter(): Promise<void> {
  const game = useGameStore.getState()
  if (game.phase !== 'playing') return

  const market = useMarketStore.getState()
  game.setAdvanceError(null)
  game.setPhase('advancing')
  market.setNewsLoading(true)
  market.setNewsLoadingProgress(0)

  const seed       = game.mode === 'contest' ? game.contest?.seed : undefined
  const endingYear = game.currentYear
  const endingQ    = game.currentQuarter
  const qIndex     = quarterIndexOf(endingYear, endingQ)

  // 대회: 이번 분기를 마감하지 못해 서버가 페널티를 표시했다면 가격 변동 전에 적용한다
  if (game.mode === 'contest') {
    const rs = useContestRoundStore.getState().state
    if (rs && rs.myPenaltyRounds.includes(qIndex) && !game.penalties.some(p => p.qIndex === qIndex)) {
      const { cashLoss, stockLosses } = usePortfolioStore.getState().applyPenalty(penaltyRateOf(game.contest))
      useGameStore.getState().recordPenalty({ qIndex, cashLoss, stockLosses })
    }
  }

  // 1. 현재 뉴스 priceImpact → 위험 요소 주사위 포함 가격 변동 계산 + 적용
  //    대회 모드는 시드로 주사위·노이즈가 정해져 모든 참가자가 같은 결과를 받는다
  const rng = seed ? createRng(`${seed}:outcome:${qIndex}`) : undefined
  const currentNews = useMarketStore.getState().currentNews
  const { changes, flipped, flippedArticleId } = computePriceChanges(currentNews, rng)
  const flippedArticle = flippedArticleId ? currentNews.find(a => a.id === flippedArticleId) ?? null : null
  useMarketStore.getState().setDiceResult(flipped, flippedArticle)
  useMarketStore.getState().applyQuarterPriceChanges(changes, `Y${endingYear}Q${endingQ}`)

  // 2. 이번 분기 종료 시점 포트폴리오 스냅샷 → 다음 분기 비교 기준
  usePortfolioStore.getState().snapshotPositions()

  // 3. 마지막 분기였다면 게임 종료 — 다음 분기도, 뉴스 생성도 없다
  if (qIndex >= game.totalQuarters) {
    useGameStore.getState().finishGame()
    useMarketStore.getState().setNewsLoadingProgress(0)
    useMarketStore.getState().setNewsLoading(false)
    void syncContestScore()
    return
  }

  // 4. 분기 카운터 증가
  useGameStore.getState().nextQuarter()
  const nextYear = useGameStore.getState().currentYear
  const nextQ    = useGameStore.getState().currentQuarter

  // 5. 다음 분기 뉴스 생성 — 기사 완성 시마다 progress 업데이트 (0~8)
  try {
    const stocks = useMarketStore.getState().stocks
    const news = await generateQuarterNews(nextYear, nextQ, stocks, useMarketStore.getState().setNewsLoadingProgress, seed)
    useMarketStore.getState().setNews(news)
  } catch (err) {
    useMarketStore.getState().setNews([])
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    useGameStore.getState().setAdvanceError(`뉴스 생성 실패 — ${msg}`)
  }

  useMarketStore.getState().setNewsLoadingProgress(8)
  useMarketStore.getState().setNewsLoading(false)
  useGameStore.getState().setPhase('playing')
  // 새 분기의 제한시간은 뉴스가 준비된 뒤부터 센다. 대회에서는 서버가 정한 라운드 시작 시각을 따른다.
  const serverStart = game.mode === 'contest' ? useContestRoundStore.getState().state?.roundStartedAt ?? undefined : undefined
  useGameStore.getState().startRoundTimer(serverStart)
  setTimeout(() => useMarketStore.getState().setNewsLoadingProgress(0), 400)

  // 분기 전환 결과 팝업 데이터 저장
  useGameStore.getState().setQuarterResult({
    endingYear,
    endingQuarter: endingQ,
    newYear: nextYear,
    newQuarter: nextQ,
    changes,
  })

  // 6. 대회 모드: 마감한 분기까지의 내 점수를 리더보드에 올린다
  void syncContestScore()
}

/**
 * 대회 모드: 이번 분기 마감 — "투자를 마쳤다"고 서버에 알린다.
 * 마감하면 이번 분기에는 더 거래할 수 없고, 전원이 마감하거나 제한시간이 지나면 모두 함께 다음 분기로 넘어간다.
 */
export async function markRoundDone(): Promise<void> {
  const g = useGameStore.getState()
  if (g.mode !== 'contest' || !g.contest || g.phase !== 'playing') return

  const qIndex = quarterIndexOf(g.currentYear, g.currentQuarter)
  g.setAdvanceError(null)
  try {
    await finishRound(g.contest.code, g.userName, qIndex)
    useGameStore.getState().markRoundSubmitted(qIndex)
    // 내가 마지막 한 명이었다면 바로 넘어가도록 상태를 곧바로 다시 가져온다
    const rs = await getRoundState(g.contest.code, g.userName)
    useContestRoundStore.getState().setState(rs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '마감하지 못했습니다.'
    // 서버가 이미 다음 라운드로 넘겼다면 곧 자동으로 이어지므로 오류로 보여주지 않는다
    if (!msg.includes('라운드가 이미 바뀌었습니다')) useGameStore.getState().setAdvanceError(msg)
  }
}

/**
 * 대회 모드: 대기실에서 기다리다 진행자가 시작하면 1분기를 연다.
 * 같은 시드로 시작가와 1분기 뉴스를 만든다 — 같은 코드의 모든 참가자가 같은 조건을 받는다.
 */
let beginning = false
export async function beginContestGame(): Promise<void> {
  const g = useGameStore.getState()
  const rs = useContestRoundStore.getState().state
  if (beginning || g.phase !== 'lobby' || !g.contest || !rs) return
  beginning = true
  try {
    const c = g.contest
    useMarketStore.getState().resetMarket(c.seed)
    usePortfolioStore.getState().init(c.initialCapital)
    const stocks = useMarketStore.getState().stocks
    const news = await generateQuarterNews(1, 1, stocks, undefined, c.seed)
    useMarketStore.getState().setNews(news)
    useGameStore.getState().beginContest()
    useGameStore.getState().startRoundTimer(rs.roundStartedAt ?? undefined)
  } catch (err) {
    useGameStore.getState().setAdvanceError(err instanceof Error ? err.message : '대회를 시작하지 못했습니다.')
  } finally {
    beginning = false
  }
}
