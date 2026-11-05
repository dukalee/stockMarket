import AppShell from '../components/layout/AppShell'
import StockList from '../components/market/StockList'
import StockDetail from '../components/market/StockDetail'
import OrderPanel from '../components/trading/OrderPanel'
import { useQuarterAdvance } from '../hooks/useQuarterAdvance'

export default function TradePage() {
  const { advance, isAdvancing, advanceError } = useQuarterAdvance()

  return (
    <AppShell fill isAdvancing={isAdvancing} onAdvance={advance} advanceError={advanceError}>
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <StockList />
        <StockDetail />
        <OrderPanel />
      </div>
    </AppShell>
  )
}
