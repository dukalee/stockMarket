import { Clock } from 'lucide-react'
import { useGameStore, penaltyRateOf } from '../../stores/gameStore'
import { useMarketStore } from '../../stores/marketStore'

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

/** 대회 모드에서 제한시간을 넘겼을 때 한 번 뜨는 페널티 안내 */
export default function TimeoutNoticeModal() {
  const notice  = useGameStore(s => s.timeoutNotice)
  const contest = useGameStore(s => s.contest)
  const clear   = useGameStore(s => s.clearTimeoutNotice)
  const stocks  = useMarketStore(s => s.stocks)

  if (!notice) return null

  const nameOf = (id: string) => stocks.find(s => s.id === id)?.name ?? id
  const pct = Math.round(penaltyRateOf(contest) * 100)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4" role="alertdialog" aria-modal="true" aria-label="제한시간 초과">
      <div className="w-full max-w-sm bg-paper-card border-4 border-double border-ink p-7 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Clock size={30} className="text-up" />
          <h2 className="font-serif font-black text-xl m-0">제한시간이 지났습니다</h2>
          <p className="text-ink-soft text-sm leading-relaxed m-0">
            제한시간 안에 이번 분기를 마치지 못해<br />
            보유한 현금과 주식의 {pct}%를 잃었습니다.
          </p>
        </div>

        <div className="border-y border-ink flex flex-col text-sm">
          <div className="flex justify-between py-3 border-b border-rule">
            <span className="text-mute">현금</span>
            <span className="font-bold text-up">-{fmt(notice.cashLoss)}</span>
          </div>
          {notice.stockLosses.length > 0 ? (
            notice.stockLosses.map(l => (
              <div key={l.stockId} className="flex justify-between py-3 border-b border-rule last:border-b-0">
                <span className="text-mute">{nameOf(l.stockId)}</span>
                <span className="font-bold text-up">-{l.shares.toLocaleString('ko-KR')}주</span>
              </div>
            ))
          ) : (
            <p className="m-0 py-3 text-mute">차감된 주식이 없습니다.</p>
          )}
        </div>

        <p className="m-0 text-xs text-mute text-center">페널티는 분기마다 한 번만 적용됩니다. 이번 분기를 계속 진행할 수 있습니다.</p>
        <button onClick={clear} className="h-11 bg-ink hover:bg-ink-soft text-paper text-sm font-bold transition-colors">
          확인
        </button>
      </div>
    </div>
  )
}
