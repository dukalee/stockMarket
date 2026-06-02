import type { Stock } from '../../types'

interface Props {
  stock:      Stock
  isSelected: boolean
  onClick:    () => void
}

const pctChg = (cur: number, open: number) => ((cur - open) / open) * 100
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

export default function StockRow({ stock, isSelected, onClick }: Props) {
  const pct          = pctChg(stock.currentPrice, stock.openPrice)
  const displayPrice = stock.currentPrice.toLocaleString('ko-KR')

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 flex items-center gap-1.5 text-xs transition-colors ${
        isSelected ? 'bg-gray-200' : 'hover:bg-gray-100'
      }`}
    >
      <span className="flex-1 min-w-0 truncate text-emerald-600 font-semibold text-left">
        {stock.name}
      </span>
      <span className="shrink-0 text-gray-600">{displayPrice}</span>
      <span className={`shrink-0 font-medium w-12 text-right ${
        pct > 0 ? 'text-red-600' : pct < 0 ? 'text-blue-600' : 'text-gray-900'
      }`}>
        {fmtPct(pct)}
      </span>
    </button>
  )
}
