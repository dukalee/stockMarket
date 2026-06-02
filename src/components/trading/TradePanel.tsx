import { useState } from 'react'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'
import { useGameStore } from '../../stores/gameStore'

interface Props {
  type: 'buy' | 'sell'
  stockId: string
  price: number
  disabled?: boolean
}

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`

function Row({ label, value, valueClass = 'text-gray-900' }: {
  label: string; value: string; valueClass?: string
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}

export default function TradePanel({ type, stockId, price, disabled }: Props) {
  const isBuy      = type === 'buy'
  const buyStock   = usePortfolioStore(s => s.buyStock)
  const sellStock  = usePortfolioStore(s => s.sellStock)
  const cash       = usePortfolioStore(s => s.cash)
  const positions  = usePortfolioStore(s => s.positions)
  const stocks     = useMarketStore(s => s.stocks)
  const year       = useGameStore(s => s.currentYear)
  const quarter    = useGameStore(s => s.currentQuarter)

  const held      = positions[stockId]?.shares ?? 0
  const stockName = stocks.find(s => s.id === stockId)?.name ?? stockId
  const qLabel    = `Y${year}Q${quarter}`
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
  const notEnough    = !isBuy && isValidQty && held < qty
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
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-sm ${isBuy ? 'text-red-600' : 'text-blue-600'}`}>
            {isBuy ? '매수' : '매도'}
          </h3>
          {/* 전체 매도 버튼 */}
          {!isBuy && held > 0 && (
            <button
              onClick={() => setQtyStr(String(held))}
              className="text-xs text-blue-600 hover:text-blue-500 border border-blue-300 hover:border-blue-400 px-2 py-0.5 rounded transition-colors"
            >
              전체 매도 ({held}주)
            </button>
          )}
        </div>

        {/* 수량 입력 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-gray-500 text-xs">수량</label>
            {isBuy && maxBuy > 0 && (
              <button
                onClick={() => setQtyStr(String(maxBuy))}
                className="text-xs text-red-600 hover:text-red-500 transition-colors"
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
              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center text-lg leading-none shrink-0"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={qtyStr}
              onChange={e => setQtyStr(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="수량"
              className="flex-1 bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-900 text-center focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => setQtyStr(q => {
                const n = parseInt(q, 10)
                return String(isNaN(n) ? 1 : n + 1)
              })}
              className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center text-lg leading-none shrink-0"
            >+</button>
          </div>
        </div>

        {/* 금액 정보 */}
        <div className="flex flex-col gap-1.5 text-sm">
          {isValidQty && (
            <div className="flex justify-between text-gray-500">
              <span>{isBuy ? '예상 금액' : '예상 수익'}</span>
              <span className="text-gray-900">{fmt(total)}</span>
            </div>
          )}
          {isBuy && (
            <div className="flex justify-between text-gray-500">
              <span>보유 현금</span>
              <span className={cannotAfford ? 'text-red-600' : 'text-gray-900'}>{fmt(cash)}</span>
            </div>
          )}
          {!isBuy && held > 0 && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>보유 수량</span>
                <span className={notEnough ? 'text-red-600' : 'text-gray-900'}>{held.toLocaleString('ko-KR')}주</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>전체 매도 시</span>
                <span className="text-blue-600">{fmt(held * price)}</span>
              </div>
            </>
          )}
        </div>

        <button
          onClick={openConfirm}
          disabled={isDisabled}
          className={`py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            isBuy
              ? 'bg-red-700 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white'
              : 'bg-blue-700 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white'
          }`}
        >
          {isBuy ? '매수' : '매도'}
        </button>
      </div>

      {/* 확인 팝업 */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeConfirm}
        >
          <div
            className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-7 flex flex-col gap-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {done ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className={`text-3xl ${isBuy ? 'text-red-600' : 'text-blue-600'}`}>✓</span>
                <p className="text-gray-900 font-semibold">{isBuy ? '매수 완료' : '매도 완료'}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className={`font-bold text-base ${isBuy ? 'text-red-600' : 'text-blue-600'}`}>
                    {isBuy ? '매수 주문 확인' : '매도 주문 확인'}
                  </h2>
                  <button onClick={closeConfirm} className="text-gray-400 hover:text-gray-900 text-xl leading-none">×</button>
                </div>

                <div className="bg-gray-100 rounded-xl p-4 flex flex-col gap-3 text-sm">
                  <Row label="종목" value={`${stockId} · ${stockName}`} />
                  <Row label="구분" value={isBuy ? '매수' : '매도'} valueClass={isBuy ? 'text-red-600' : 'text-blue-600'} />
                  <Row label="수량" value={`${qty.toLocaleString('ko-KR')}주`} />
                  <Row label="단가" value={fmt(price)} />
                  <div className="border-t border-gray-300 pt-3">
                    <Row
                      label={isBuy ? '총 매수금액' : '총 수익금'}
                      value={fmt(total)}
                      valueClass="text-gray-900 font-bold text-base"
                    />
                  </div>
                  {isBuy && (
                    <Row label="거래 후 잔금" value={fmt(cash - total)} valueClass="text-gray-600" />
                  )}
                  {!isBuy && (
                    <Row label="거래 후 잔금" value={fmt(cash + total)} valueClass="text-gray-600" />
                  )}
                </div>

                {error && <p className="text-red-600 text-xs text-center">{error}</p>}

                <div className="flex gap-3">
                  <button onClick={closeConfirm}
                    className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors">
                    취소
                  </button>
                  <button onClick={handleExecute}
                    className={`flex-1 py-2.5 rounded-lg font-semibold text-sm text-white transition-colors ${
                      isBuy ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'
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
