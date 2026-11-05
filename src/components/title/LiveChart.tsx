import { useMarketStore } from '../../stores/marketStore'
import { useTitleLiveStore, CANDLES } from '../../stores/titleLiveStore'
import RollingNumber from './RollingNumber'

const W = 300
const H = 150

/**
 * 타이틀 화면 "오늘의 차트" — 오늘의 주가표에서 음영 표시된 종목의 가격 변화를 그대로 그린다.
 * 주가표의 가격이 바뀔 때마다 오른쪽에 새 캔들이 붙고 왼쪽이 밀려난다. (장식용)
 */
export default function LiveChart() {
  const stocks  = useMarketStore(s => s.stocks)
  const focusId = useTitleLiveStore(s => s.focusId)
  const live    = useTitleLiveStore(s => s.live)
  const history = useTitleLiveStore(s => s.history)

  const stock   = stocks.find(s => s.id === focusId)
  const candles = focusId ? history[focusId] : undefined
  const price   = focusId ? live[focusId]?.price : undefined
  if (!stock || !candles?.length || price === undefined) return <section aria-label="오늘의 차트" />

  const hi = Math.max(...candles.map(c => c.high))
  const lo = Math.min(...candles.map(c => c.low))
  const pad = (hi - lo) * 0.1 || 1
  const yMin = lo - pad, yMax = hi + pad
  const y = (p: number) => H - ((p - yMin) / (yMax - yMin)) * H
  const slot  = W / CANDLES
  const bodyW = slot * 0.62

  // 주가표와 같은 기준(게임 시작가 대비)으로 등락률을 보여준다
  const pct    = ((price - stock.openPrice) / stock.openPrice) * 100
  const last   = candles[candles.length - 1]
  const lastUp = last.close >= last.open
  const color  = (up: boolean) => (up ? '#c4262e' : '#1f4db8')

  return (
    <section className="flex flex-col" aria-label="오늘의 차트">
      <div className="flex justify-between items-baseline border-b-2 border-ink pb-2">
        <h2 className="font-serif font-black text-xl m-0">오늘의 차트</h2>
        <span className="text-sm">
          {stock.name}
          <span className="ml-1.5 text-[11px] text-mute/70">{stock.sector}</span>
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 pb-2">
        <span className="font-serif font-black text-2xl flex items-center">
          <RollingNumber value={price.toLocaleString('ko-KR')} />
          <span className="ml-0.5">원</span>
        </span>
        <span className={`text-sm font-bold flex items-center ${pct > 0 ? 'text-up' : pct < 0 ? 'text-down' : 'text-mute'}`}>
          <span aria-hidden="true">{pct > 0 ? '▲' : pct < 0 ? '▼' : '–'}</span>
          <RollingNumber value={Math.abs(pct).toFixed(1)} />%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[150px] border-y border-rule"
        role="img"
        aria-label={`${stock.name}의 가상 시세 차트`}
      >
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#dadad3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {candles.map((c, i) => {
          const x   = (i + 0.5) * slot
          const up  = c.close >= c.open
          const top = y(Math.max(c.open, c.close))
          const ht  = Math.max(1.2, Math.abs(y(c.open) - y(c.close)))
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color(up)} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <rect x={x - bodyW / 2} y={top} width={bodyW} height={ht} fill={color(up)} />
            </g>
          )
        })}
        <line x1={0} x2={W} y1={y(last.close)} y2={y(last.close)} stroke={color(lastUp)}
          strokeWidth={1} strokeDasharray="3 3" opacity={0.7} vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  )
}
