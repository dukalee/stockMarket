import AppShell from '../components/layout/AppShell'
import StockList from '../components/market/StockList'
import StockDetail from '../components/market/StockDetail'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'

export default function TradePage() {
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  return (
    <AppShell isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="h-full flex overflow-hidden">
        <StockList />
        <StockDetail />
      </div>
    </AppShell>
  )
}
