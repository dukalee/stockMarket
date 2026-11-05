import { useGameStore, quarterIndexOf } from '../stores/gameStore'
import { useMarketStore } from '../stores/marketStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { submitScore } from './contest'

/** 현재 총 자산 = 현금 + 보유 주식 평가액 */
export function computeTotalAssets(): number {
  const { cash, positions } = usePortfolioStore.getState()
  const stocks = useMarketStore.getState().stocks
  const priceOf = Object.fromEntries(stocks.map(s => [s.id, s.currentPrice]))
  return cash + Object.values(positions).reduce((sum, p) => sum + p.shares * (priceOf[p.stockId] ?? p.averageCost), 0)
}

/**
 * 대회 모드에서 지금까지 마감한 분기까지의 내 점수를 서버에 올린다.
 * 실패하면 scoreSyncError 에 메시지를 남기고, 최종 결과 화면에서 다시 보낼 수 있다.
 */
export async function syncContestScore(): Promise<boolean> {
  const game = useGameStore.getState()
  if (game.mode !== 'contest' || !game.contest) return true

  // 마감한 분기 수: 진행 중이면 현재 분기 - 1, 끝났으면 전체 분기 수
  const current = quarterIndexOf(game.currentYear, game.currentQuarter)
  const finished = game.phase === 'finished'
  const completed = finished ? game.totalQuarters : current - 1

  try {
    await submitScore({
      code: game.contest.code,
      nickname: game.userName,
      quarter: completed,
      totalAssets: computeTotalAssets(),
      finished,
    })
    game.setScoreSyncError(null)
    return true
  } catch (err) {
    game.setScoreSyncError(err instanceof Error ? err.message : '점수를 전송하지 못했습니다.')
    return false
  }
}
