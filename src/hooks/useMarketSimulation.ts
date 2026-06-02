import { useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useMarketStore } from '../stores/marketStore'
import { computeNextPrices } from '../engines/priceEngine'
import { PRICE_TICK_MS } from '../utils/constants'

export function useMarketSimulation() {
  const phase = useGameStore(s => s.phase)

  useEffect(() => {
    if (phase !== 'playing') return

    const id = setInterval(() => {
      const stocks = useMarketStore.getState().stocks
      useMarketStore.getState().tickAllPrices(computeNextPrices(stocks))
    }, PRICE_TICK_MS)

    return () => clearInterval(id)
  }, [phase])
}
