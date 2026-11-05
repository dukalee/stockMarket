import { useGameStore } from '../stores/gameStore'
import { useMarketStore } from '../stores/marketStore'
import { usePortfolioStore } from '../stores/portfolioStore'

/** 저장된 진행 상황을 모두 비워 새 게임을 시작할 수 있는 상태로 되돌린다. */
export function resetAllGameState() {
  useGameStore.getState().resetGame()
  usePortfolioStore.getState().init(0)
  useMarketStore.getState().resetMarket()
}
