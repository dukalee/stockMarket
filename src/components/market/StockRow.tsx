import type { Stock } from '../../types'

interface Props {
  stock:      Stock
  isSelected: boolean
  onClick:    () => void
}

const pctChg = (cur: number, open: number) => ((cur - open) / open) * 100
const fmtPct = (n: number) => `${n > 0 ? '▲' : n < 0 ? '▼' : '–'}${Math.abs(n).toFixed(1)}`

export default function StockRow({ stock, isSelected, onClick }: Props) {
  const pct          = pctChg(stock.currentPrice, stock.openPrice)
  const displayPrice = stock.currentPrice.toLocaleString('ko-KR')

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className={`w-full px-3 py-3 flex items-baseline gap-2 text-sm border-b border-rule transition-colors ${
        isSelected ? 'bg-paper-deep' : 'hover:bg-paper-deep/60'
      }`}
    >
      <span className={`flex-1 min-w-0 truncate text-left text-ink ${isSelected ? 'font-bold' : 'font-medium'}`}>
        {stock.name}
        <span className="ml-1.5 text-[11px] font-normal text-mute/70">{stock.sector}</span>
      </span>
      <span className="shrink-0 text-ink-soft">{displayPrice}</span>
      <span className={`shrink-0 font-bold w-14 text-right ${
        pct > 0 ? 'text-up' : pct < 0 ? 'text-down' : 'text-mute'
      }`}>
        {fmtPct(pct)}
      </span>
    </button>
  )
}
