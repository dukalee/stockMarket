import { useEffect } from 'react'
import { useMarketStore } from '../../stores/marketStore'
import { useTitleLiveStore } from '../../stores/titleLiveStore'
import RollingNumber from './RollingNumber'

const TICK_MS = 1400   // n초마다 가격이 바뀐다

/** 타이틀 화면 "오늘의 주가" — 가격과 등락이 몇 초마다 무작위로 바뀌고, 숫자는 굴러가며 바뀐다 (장식용) */
export default function LivePriceBoard() {
  const stocks  = useMarketStore(s => s.stocks)
  const ids     = useTitleLiveStore(s => s.ids)
  const live    = useTitleLiveStore(s => s.live)
  const focusId = useTitleLiveStore(s => s.focusId)
  const init    = useTitleLiveStore(s => s.init)
  const tick    = useTitleLiveStore(s => s.tick)

  // 종목 목록이 새로 만들어질 때(새 게임 시작가)마다 초기화
  useEffect(() => { init(stocks) }, [stocks, init])

  useEffect(() => {
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [tick])

  const rows = ids.map(id => stocks.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s)

  return (
    <section className="flex flex-col" aria-label="오늘의 주가">
      <div className="flex justify-between items-baseline border-b-2 border-ink pb-2">
        <h2 className="font-serif font-black text-xl m-0">오늘의 주가</h2>
        <span className="text-xs text-mute">단위 원</span>
      </div>
      {rows.map(s => {
        const l       = live[s.id] ?? { price: s.currentPrice, tick: 0, dir: null }
        const pct     = ((l.price - s.openPrice) / s.openPrice) * 100
        const flash   = l.dir === 'up' ? 'flash-up' : l.dir === 'down' ? 'flash-down' : ''
        const focused = s.id === focusId
        return (
          // 줄 자체는 계속 유지해서 숫자 칸이 굴러가게 하고, 깜빡임 막은 갱신될 때마다 새로 만들어 다시 재생한다
          <div
            key={s.id}
            className={`relative flex items-center justify-between py-[9px] px-1 border-b border-rule text-[15px] ${focused ? 'bg-paper-deep' : ''}`}
          >
            {flash && (
              <span
                key={l.tick}
                aria-hidden="true"
                className={`absolute inset-0 pointer-events-none ${flash}`}
              />
            )}
            <span className="font-medium w-[156px] shrink-0 whitespace-nowrap">
              {s.name}
              <span className="ml-1.5 text-[11px] font-normal text-mute/70">{s.sector}</span>
            </span>
            <span className="flex-1 flex justify-end">
              <RollingNumber value={l.price.toLocaleString('ko-KR')} />
            </span>
            <span className={`w-[64px] flex items-center justify-end font-bold ${pct > 0 ? 'text-up' : pct < 0 ? 'text-down' : 'text-mute'}`}>
              <span aria-hidden="true">{pct > 0 ? '▲' : pct < 0 ? '▼' : '–'}</span>
              <RollingNumber value={Math.abs(pct).toFixed(1)} />
            </span>
          </div>
        )
      })}
      <p className="m-0 pt-2 text-[11px] text-mute/70">음영 표시된 종목이 아래 차트에 나옵니다.</p>
    </section>
  )
}
