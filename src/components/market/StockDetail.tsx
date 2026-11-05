import { useMarketStore } from '../../stores/marketStore'
import PriceChart from './PriceChart'

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const pctChg = (cur: number, open: number) => ((cur - open) / open) * 100
const fmtPct = (n: number) => `${n > 0 ? '▲' : n < 0 ? '▼' : '–'} ${Math.abs(n).toFixed(1)}%`

export default function StockDetail() {
  const stocks     = useMarketStore(s => s.stocks)
  const selectedId = useMarketStore(s => s.selectedStockId)

  const stock      = stocks.find(s => s.id === selectedId) ?? null

  if (!stock) {
    return (
      <div className="flex-1 flex items-center justify-center text-mute text-sm">
        좌측에서 종목을 선택하세요
      </div>
    )
  }

  const pct  = pctChg(stock.currentPrice, stock.openPrice)

  return (
    <div className="flex-1 flex flex-col h-full px-7 py-5 gap-4 overflow-y-auto min-w-0">
      {/* 종목 헤더 */}
      <div className="shrink-0 flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif font-black text-[36px] leading-tight tracking-tight">{stock.name}</h2>
          <span className="text-mute text-sm">{stock.id}</span>
          <span className="text-sm text-mute/70">{stock.sector}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-serif font-black text-[38px] leading-tight tracking-tight">{fmt(stock.currentPrice)}</span>
          <span className={`text-lg font-bold ${pct > 0 ? 'text-up' : pct < 0 ? 'text-down' : 'text-mute'}`}>
            {fmtPct(pct)}
          </span>
        </div>
      </div>

      {/* 가격 차트 */}
      <figure className="flex-1 min-h-[260px] m-0 flex flex-col gap-1.5">
        <div className="flex-1 min-h-0 relative border-y border-ink">
          <div className="absolute inset-0">
            <PriceChart
              history={stock.priceHistory}
              openPrice={stock.priceHistory[0]?.price ?? stock.openPrice}
            />
          </div>
        </div>
      </figure>

      {/* 분기 시작가, 고가, 저가 */}
      <dl className="grid grid-cols-3 shrink-0 border-y border-ink divide-x divide-rule m-0">
        {[
          { label: '분기 시작가', value: fmt(stock.openPrice), cls: '' },
          { label: '고가',        value: fmt(stock.high),      cls: 'text-up' },
          { label: '저가',        value: fmt(stock.low),       cls: 'text-down' },
        ].map(({ label, value, cls }, i) => (
          <div key={label} className={`py-2.5 flex flex-col gap-0.5 ${i > 0 ? 'pl-4' : ''}`}>
            <dt className="text-mute text-xs">{label}</dt>
            <dd className={`m-0 text-base font-bold ${cls}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
