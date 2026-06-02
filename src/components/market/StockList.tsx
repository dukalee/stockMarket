import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useMarketStore } from '../../stores/marketStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useGameStore } from '../../stores/gameStore'
import StockRow from './StockRow'
import type { Sector } from '../../types'

type Filter = '보유 종목' | '전체' | Sector
const FILTERS: Filter[] = ['보유 종목', '전체', '기술', '교육', '금융', '물류', '게임']

export default function StockList() {
  const stocks      = useMarketStore(s => s.stocks)
  const selectedId  = useMarketStore(s => s.selectedStockId)
  const selectStock = useMarketStore(s => s.selectStock)
  const positions   = usePortfolioStore(s => s.positions)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)

  const [filter, setFilter] = useState<Filter>(
    Object.keys(positions).length > 0 ? '보유 종목' : '전체'
  )

  // 분기가 바뀔 때마다 필터 리셋: 보유 종목 있으면 "보유 종목", 없으면 "전체"
  useEffect(() => {
    setFilter(Object.keys(positions).length > 0 ? '보유 종목' : '전체')
  }, [currentYear, currentQuarter])

  // 선택된 종목이 없으면 사성전자(SSEI)를 기본 선택
  useEffect(() => {
    if (!selectedId) {
      selectStock('SSEI')
    }
  }, [selectedId])

  const filtered =
    filter === '보유 종목' ? stocks.filter(s => positions[s.id])
    : filter === '전체'    ? stocks
    : stocks.filter(s => s.sector === filter)

  return (
    <aside className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden shrink-0">
      {/* 섹터 필터 */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as Filter)}
            className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 appearance-none focus:outline-none focus:border-emerald-500"
          >
            {FILTERS.map(f => <option key={f}>{f}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* 헤더 */}
      <div className="px-3 py-2 flex items-center gap-1.5 text-xs text-gray-400 border-b border-gray-200">
        <span className="flex-1">종목명</span>
        <span>현재가</span>
        <span className="w-12 text-right">등락</span>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(stock => (
          <StockRow
            key={stock.id}
            stock={stock}
            isSelected={selectedId === stock.id}
            onClick={() => selectStock(stock.id)}
          />
        ))}
      </div>
    </aside>
  )
}
