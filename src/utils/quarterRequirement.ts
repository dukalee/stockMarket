import type { Position, Stock, Transaction } from '../types'
import { getSellableShares } from '../stores/portfolioStore'

/** 분기를 넘기려면 이번 분기에 서로 다른 종목 2개 이상, 서로 다른 섹터 2개 이상을 매수해서 보유해야 한다 */
export const REQUIRED_STOCKS = 2
export const REQUIRED_SECTORS = 2

export interface QuarterContext {
  positions: Record<string, Position>
  transactions: Transaction[]
  stocks: Stock[]
  /** 이번 분기 표기 (예: "Y1Q2") */
  qLabel: string
}

/** 이번 분기에 매수해서 보유 중인 종목과 그 섹터. plusStockId 를 주면 그 종목도 샀다고 치고 센다. */
export function getQuarterBuys(ctx: QuarterContext, plusStockId?: string) {
  const ids = new Set(
    ctx.transactions.filter(t => t.type === 'buy' && t.quarter === ctx.qLabel).map(t => t.stockId),
  )
  if (plusStockId) ids.add(plusStockId)
  const stockIds = [...ids].filter(id => id === plusStockId || (ctx.positions[id]?.shares ?? 0) > 0)
  const sectors = [...new Set(stockIds.map(id => ctx.stocks.find(s => s.id === id)?.sector).filter((s): s is Stock['sector'] => !!s))]
  return { stockIds, sectors }
}

export interface BuyCheck {
  /** 이 매수를 하고 나서도 이번 분기 진행 조건을 채울 수 있는가 */
  ok: boolean
  /** 조건을 채울 수 있게 남기면서 살 수 있는 최대 수량 (조건을 이미 채웠다면 제한 없음 = Infinity) */
  maxQty: number
  /** 조건을 채우려면 따로 남겨 둬야 하는 최소 금액 = 아직 안 산 섹터의 가장 싼 종목 1주. 이미 채웠다면 0 */
  reserve: number
  reserveStock?: Stock
  /** 이 매수를 포함해 이번 분기에 산 서로 다른 종목·섹터 수 */
  stockCount: number
  sectorCount: number
  /** 이 매수로 조건(종목·섹터 수)을 이미 채우게 되는가 */
  satisfied: boolean
}

/**
 * 이 매수가 "조건을 영영 채울 수 없는 상태"로 몰고 가지 않는지 확인한다.
 *
 * 이번 분기에 산 주식은 같은 분기에 팔 수 없으므로, 한 섹터에 돈을 다 써 버리면 다른 섹터 종목을 살 방법이 없어져
 * 분기를 넘길 수 없게 된다. 아직 조건을 채우지 못했다면 "다른 섹터의 가장 싼 종목 1주"를 살 돈이 남아야 한다.
 * 이전 분기부터 가지고 있던 주식은 같은 분기에도 팔 수 있으므로, 그 매도 가능분의 값도 쓸 수 있는 돈으로 본다.
 */
export function checkBuyKeepsRequirementReachable(
  ctx: QuarterContext,
  cash: number,
  stockId: string,
  price: number,
  qty: number,
): BuyCheck {
  const buys = getQuarterBuys(ctx, stockId)
  const stockCount = buys.stockIds.length
  const sectorCount = buys.sectors.length
  const satisfied = stockCount >= REQUIRED_STOCKS && sectorCount >= REQUIRED_SECTORS
  if (satisfied) {
    return { ok: true, maxQty: Infinity, reserve: 0, stockCount, sectorCount, satisfied }
  }

  // 아직 안 산 섹터의 가장 싼 종목
  const candidates = ctx.stocks.filter(s => !buys.sectors.includes(s.sector))
  const reserveStock = candidates.reduce<Stock | undefined>((min, s) => (!min || s.currentPrice < min.currentPrice ? s : min), undefined)
  const reserve = reserveStock?.currentPrice ?? 0

  // 이번 분기에 팔 수 있는 (이전 분기부터 보유한) 주식의 값
  const sellableValue = Object.keys(ctx.positions).reduce((sum, id) => {
    const px = ctx.stocks.find(s => s.id === id)?.currentPrice ?? 0
    return sum + getSellableShares(ctx.positions, ctx.transactions, id, ctx.qLabel) * px
  }, 0)

  const maxQty = price > 0 ? Math.max(0, Math.floor((cash + sellableValue - reserve) / price)) : 0
  return { ok: qty <= maxQty, maxQty, reserve, reserveStock, stockCount, sectorCount, satisfied }
}
