import { useState } from 'react'
import { usePortfolioStore, getSellableShares } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'
import { useGameStore } from '../../stores/gameStore'

interface Props {
  type: 'buy' | 'sell'
  stockId: string
  price: number
  disabled?: boolean
  /** true 이면 바깥 테두리·제목 없이 내용만 그린다 (OrderPanel 안에 넣을 때) */
  embedded?: boolean
}

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

function Row({ label, value, valueClass = 'text-ink' }: {
  label: string; value: string; valueClass?: string
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-mute">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}

export default function TradePanel({ type, stockId, price, disabled, embedded = false }: Props) {
  const isBuy      = type === 'buy'
  const buyStock   = usePortfolioStore(s => s.buyStock)
  const sellStock  = usePortfolioStore(s => s.sellStock)
  const cash       = usePortfolioStore(s => s.cash)
  const positions  = usePortfolioStore(s => s.positions)
  const transactions = usePortfolioStore(s => s.transactions)
  const stocks     = useMarketStore(s => s.stocks)
  const year       = useGameStore(s => s.currentYear)
  const quarter    = useGameStore(s => s.currentQuarter)

  const held      = positions[stockId]?.shares ?? 0
  const stockName = stocks.find(s => s.id === stockId)?.name ?? stockId
  const qLabel    = `Y${year}Q${quarter}`
  const sellable  = getSellableShares(positions, transactions, stockId, qLabel)
  const locked    = held - sellable   // 이번 분기에 매수해서 아직 팔 수 없는 수량
  const maxBuy    = price > 0 ? Math.floor(cash / price) : 0

  // 수량: 빈 문자열 허용 (직접 입력 지원)
  const [qtyStr,  setQtyStr]  = useState('1')
  const [confirm, setConfirm] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  const qty         = parseInt(qtyStr, 10)
  const isValidQty  = !isNaN(qty) && qty > 0
  const total       = isValidQty ? qty * price : 0
  const cannotAfford = isBuy  && isValidQty && cash < total
  const notEnough    = !isBuy && isValidQty && sellable < qty
  const isDisabled   = disabled || !isValidQty || cannotAfford || notEnough

  const openConfirm  = () => { setError(null); setDone(false); setConfirm(true) }
  const closeConfirm = () => setConfirm(false)

  const handleExecute = () => {
    if (!isValidQty) return
    const result = isBuy
      ? buyStock(stockId, qty, price, qLabel)
      : sellStock(stockId, qty, price, qLabel)
    if (result) { setError(result); return }
    setDone(true)
    setTimeout(() => { setConfirm(false); setDone(false) }, 900)
  }

  return (
    <>
      <div className={embedded ? 'flex flex-col gap-4' : 'bg-paper-card border border-ink p-5 flex flex-col gap-4'}>
        {/* 헤더 */}
        <div className={`flex items-center ${embedded ? 'justify-end empty:hidden' : 'justify-between'}`}>
          {!embedded && (
            <h3 className={`font-serif font-black text-lg border-b-2 pb-1 ${isBuy ? 'text-up border-up' : 'text-down border-down'}`}>
              {isBuy ? '매수' : '매도'}
            </h3>
          )}
          {/* 전체 매도 버튼 */}
          {!isBuy && sellable > 0 && (
            <button
              onClick={() => setQtyStr(String(sellable))}
              className="text-xs text-down border border-down hover:bg-down hover:text-white px-2 py-1 transition-colors"
            >
              전체 매도 ({sellable}주)
            </button>
          )}
        </div>

        {/* 수량 입력 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-mute text-xs">수량</label>
            {isBuy && maxBuy > 0 && (
              <button
                onClick={() => setQtyStr(String(maxBuy))}
                className="text-xs text-up underline underline-offset-2 transition-colors"
              >
                최대 {maxBuy.toLocaleString('ko-KR')}주
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQtyStr(q => {
                const n = parseInt(q, 10)
                return isNaN(n) || n <= 1 ? '1' : String(n - 1)
              })}
              className="w-10 h-10 border border-ink bg-transparent hover:bg-paper-deep text-ink flex items-center justify-center text-lg leading-none shrink-0"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="수량"
              className="flex-1 min-w-0 h-10 bg-transparent border-0 border-b border-ink px-3 text-ink text-center text-lg font-bold"
            />
            <button
              onClick={() => setQtyStr(q => {
                const n = parseInt(q, 10)
                return String(isNaN(n) ? 1 : n + 1)
              })}
              className="w-10 h-10 border border-ink bg-transparent hover:bg-paper-deep text-ink flex items-center justify-center text-lg leading-none shrink-0"
            >+</button>
          </div>
        </div>

        {/* 금액 정보 */}
        <div className="flex flex-col gap-1.5 text-sm">
          {isValidQty && (
            <div className="flex justify-between text-mute">
              <span>{isBuy ? '예상 금액' : '예상 수익'}</span>
              <span className="text-ink font-bold">{fmt(total)}</span>
            </div>
          )}
          {isBuy && (
            <div className="flex justify-between text-mute">
              <span>보유 현금</span>
              <span className={cannotAfford ? 'text-up' : 'text-ink'}>{fmt(cash)}</span>
            </div>
          )}
          {!isBuy && held > 0 && (
            <>
              <div className="flex justify-between text-mute">
                <span>보유 수량</span>
                <span className="text-ink">{held.toLocaleString('ko-KR')}주</span>
              </div>
              <div className="flex justify-between text-mute">
                <span>매도 가능 수량</span>
                <span className={notEnough ? 'text-up' : 'text-ink'}>{sellable.toLocaleString('ko-KR')}주</span>
              </div>
              {sellable > 0 && (
                <div className="flex justify-between text-mute">
                  <span>매도 가능분 전체 매도 시</span>
                  <span className="text-down">{fmt(sellable * price)}</span>
                </div>
              )}
              {locked > 0 && (
                <p className="m-0 text-xs text-up leading-relaxed">
                  이번 분기에 매수한 {locked.toLocaleString('ko-KR')}주는 다음 분기부터 매도할 수 있습니다.
                </p>
              )}
            </>
          )}
        </div>

        <button
          onClick={openConfirm}
          disabled={isDisabled}
          className={`h-11 font-bold text-sm transition disabled:bg-rule disabled:text-mute text-white hover:brightness-110 ${
            isBuy ? 'bg-up' : 'bg-down'
          }`}
        >
          {isBuy ? '매수' : '매도'}
        </button>
      </div>

      {/* 확인 팝업 */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={closeConfirm}
        >
          <div
            className="w-full max-w-sm bg-paper-card border-4 border-double border-ink p-7 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            {done ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className={`text-3xl ${isBuy ? 'text-up' : 'text-down'}`}>✓</span>
                <p className="text-ink font-serif font-black text-lg">{isBuy ? '매수 완료' : '매도 완료'}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className={`font-serif font-black text-xl ${isBuy ? 'text-up' : 'text-down'}`}>
                    {isBuy ? '매수 주문 확인' : '매도 주문 확인'}
                  </h2>
                  <button onClick={closeConfirm} className="text-mute hover:text-ink text-xl leading-none w-8 h-8">×</button>
                </div>

                <div className="border-y border-ink py-3 flex flex-col gap-3 text-sm">
                  <Row label="종목" value={`${stockId}, ${stockName}`} />
                  <Row label="구분" value={isBuy ? '매수' : '매도'} valueClass={isBuy ? 'text-up' : 'text-down'} />
                  <Row label="수량" value={`${qty.toLocaleString('ko-KR')}주`} />
                  <Row label="단가" value={fmt(price)} />
                  <div className="border-t border-rule pt-3">
                    <Row
                      label={isBuy ? '총 매수금액' : '총 수익금'}
                      value={fmt(total)}
                      valueClass="text-ink font-bold text-base"
                    />
                  </div>
                  {isBuy && (
                    <Row label="거래 후 잔금" value={fmt(cash - total)} valueClass="text-ink-soft" />
                  )}
                  {!isBuy && (
                    <Row label="거래 후 잔금" value={fmt(cash + total)} valueClass="text-ink-soft" />
                  )}
                </div>

                {error && <p className="text-up text-xs text-center">{error}</p>}

                <div className="flex gap-3">
                  <button onClick={closeConfirm}
                    className="flex-1 h-11 border border-ink text-ink hover:bg-paper-deep text-sm font-medium transition-colors">
                    취소
                  </button>
                  <button onClick={handleExecute}
                    className={`flex-1 h-11 font-bold text-sm text-white transition hover:brightness-110 ${
                      isBuy ? 'bg-up' : 'bg-down'
                    }`}>
                    {isBuy ? '매수 실행' : '매도 실행'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
