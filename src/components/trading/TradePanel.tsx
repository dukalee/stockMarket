import { useState } from 'react'
import { usePortfolioStore, getSellableShares } from '../../stores/portfolioStore'
import { useMarketStore } from '../../stores/marketStore'
import { useGameStore } from '../../stores/gameStore'
import { checkBuyKeepsRequirementReachable, REQUIRED_SECTORS, REQUIRED_STOCKS } from '../../utils/quarterRequirement'

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
  // 이번 분기에 산 주식은 같은 분기에 팔 수 없다. 그래서 한 섹터에 돈을 다 쓰면 분기 진행 조건(서로 다른 2개 종목·2개 섹터)을
  // 영영 채울 수 없게 될 수 있다 → 그런 매수는 막는다.
  const check = isBuy
    ? checkBuyKeepsRequirementReachable({ positions, transactions, stocks, qLabel }, cash, stockId, price, isValidQty ? qty : 1)
    : null
  const maxQty = isBuy && check ? Math.min(maxBuy, check.maxQty) : maxBuy        // "최대" 버튼은 조건을 지키는 한도까지만
  const blockedByRule = isBuy && isValidQty && !cannotAfford && !!check && !check.ok
  const isDisabled   = disabled || !isValidQty || cannotAfford || notEnough || blockedByRule

  const sectorName   = stocks.find(s => s.id === stockId)?.sector ?? ''
  const ruleLimit    = check && Number.isFinite(check.maxQty) ? Math.min(maxBuy, check.maxQty) : maxBuy

  const openConfirm  = () => { setError(null); setDone(false); setConfirm(true) }
  const closeConfirm = () => setConfirm(false)

  const handleExecute = () => {
    if (!isValidQty) return
    if (blockedByRule) { setError('이 수량을 사면 분기 진행 조건을 채울 수 없게 됩니다. 수량을 줄여 주세요.'); return }
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
            {isBuy && maxQty > 0 && (
              <button
                onClick={() => setQtyStr(String(maxQty))}
                className="text-xs text-up underline underline-offset-2 transition-colors"
                title={maxQty < maxBuy ? '분기 진행 조건을 채울 수 있도록 일부 현금을 남기는 한도입니다' : undefined}
              >
                최대 {maxQty.toLocaleString('ko-KR')}주
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

        {/* 매수할 때 항상 보이는 안내: 이번 분기에 산 수량은 되팔 수 없다 */}
        {isBuy && (
          <p className="m-0 text-xs text-up leading-relaxed">
            ※ 이번 분기에 매수한 수량은 같은 분기에 되팔 수 없습니다. 다음 분기부터 매도할 수 있습니다.
          </p>
        )}

        {/* 경고: 이 수량을 사면 분기 진행 조건을 채울 수 없게 되는 경우 → 매수 불가 */}
        {isBuy && blockedByRule && check && (
          <div role="alert" className="border-2 border-up bg-paper p-3 flex flex-col gap-1.5">
            <p className="m-0 text-sm font-bold text-up">⚠ 이 수량은 매수할 수 없습니다</p>
            <p className="m-0 text-xs text-ink-soft leading-relaxed">
              이번 분기에 산 주식은 되팔 수 없는데, 이 수량을 사면 남는 돈으로 <b>{sectorName} 외 다른 섹터의 종목</b>을 살 수 없어
              분기 진행 조건(서로 다른 {REQUIRED_STOCKS}개 종목·{REQUIRED_SECTORS}개 섹터 매수)을 채울 수 없게 됩니다.
            </p>
            {check.reserveStock && (
              <p className="m-0 text-xs text-ink-soft leading-relaxed">
                다른 섹터에서 가장 싼 종목은 {check.reserveStock.name}({check.reserveStock.sector}) {fmt(check.reserve)}입니다. 그만큼은 남겨 두세요.
              </p>
            )}
            <p className="m-0 text-xs font-bold text-ink">
              {ruleLimit > 0
                ? `이 종목은 최대 ${ruleLimit.toLocaleString('ko-KR')}주까지 살 수 있습니다.`
                : '이 종목은 지금 살 수 없습니다. 먼저 다른 섹터의 종목을 사세요.'}
            </p>
          </div>
        )}

        {/* 안내: 아직 조건을 못 채웠지만 이 매수 후에도 채울 수 있는 경우 */}
        {isBuy && !blockedByRule && check && !check.satisfied && isValidQty && check.reserve > 0 && (
          <p className="m-0 text-xs text-mute leading-relaxed">
            분기를 넘기려면 다른 섹터의 종목도 사야 합니다. 최소 {fmt(check.reserve)}({check.reserveStock?.name} 1주)는 남겨 두세요.
          </p>
        )}

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

                {isBuy && (
                  <p className="m-0 border border-up px-3 py-2 text-xs text-up leading-relaxed">
                    이번 분기에 매수한 {qty.toLocaleString('ko-KR')}주는 <b>같은 분기에 되팔 수 없습니다.</b> 다음 분기부터 매도할 수 있습니다.
                  </p>
                )}

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
