import { useEffect, useRef, useState } from 'react'
import type { PricePoint } from '../../types'

interface Props {
  history:   PricePoint[]
  openPrice: number
}

interface MiniCandle {
  open:         number
  close:        number
  high:         number
  low:          number
  volume:       number
  isUp:         boolean
  quarterLabel?: string  // set only on the last candle of each quarter
  xIdx:         number
}

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const STEPS  = 100  // mini-candles per quarter

function seededWave(from: number, to: number, steps: number, seed: number): number[] {
  // Brownian bridge: random walk forced to start at `from` and end at `to`.
  // Volatility is anchored to the price level so quiet quarters still look active.
  const priceMid = (from + to) / 2
  const stepVol  = priceMid * 0.07 / Math.sqrt(steps)

  // Seeded LCG — deterministic per (seed, steps) pair
  let rng = (seed * 1664525 + 1013904223) >>> 0
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0
    return (rng / 0x100000000) * 2 - 1  // uniform -1…1
  }

  // Unconstrained random walk
  const walk = new Array(steps + 1).fill(0)
  for (let i = 1; i <= steps; i++) walk[i] = walk[i - 1] + rand() * stepVol

  // Bridge correction: subtract the linear drift so walk[steps] === 0
  const endDrift = walk[steps]
  const bridge   = walk.map((v, i) => v - (i / steps) * endDrift)

  return Array.from({ length: steps + 1 }, (_, i) => {
    const linear = from + (to - from) * (i / steps)
    return Math.max(100, Math.round(linear + bridge[i]))
  })
}

function buildCandles(history: PricePoint[], gameStartPrice: number): MiniCandle[] {
  const quarterly = history.filter(p => p.quarterLabel)
  if (!quarterly.length) return []

  const result: MiniCandle[] = []
  let xIdx = 0

  quarterly.forEach((q, qi) => {
    const from   = qi === 0 ? gameStartPrice : quarterly[qi - 1].price
    const to     = q.price
    const prices = seededWave(from, to, STEPS, qi + 1)
    // prices has STEPS+1 points → STEPS candles per quarter

    for (let i = 0; i < prices.length - 1; i++) {
      const open   = prices[i]
      const close  = prices[i + 1]
      const isUp   = close >= open

      // seeded wicks: magnitude relative to the candle body + small base noise
      const wickSeed  = qi * 1000 + i * 17 + 3
      const bodyRange = Math.abs(close - open)
      const baseNoise = Math.abs(to - from) * 0.008
      const wickRange = bodyRange * 0.4 + baseNoise
      const highExtra = Math.abs(Math.sin(wickSeed * 7.31)) * wickRange
      const lowExtra  = Math.abs(Math.sin(wickSeed * 11.73)) * wickRange

      // seeded volume
      const volSeed = qi * 500 + i * 31
      const vol     = 0.25 + Math.abs(Math.sin(volSeed * 3.71)) * 0.55
                      + (bodyRange / (Math.abs(to - from) || 1)) * 0.4

      const isLast = i === prices.length - 2

      result.push({
        open,
        close,
        high:         Math.max(100, Math.round(Math.max(open, close) + highExtra)),
        low:          Math.max(100, Math.round(Math.min(open, close) - lowExtra)),
        volume:       vol,
        isUp,
        quarterLabel: isLast ? q.quarterLabel : undefined,
        xIdx:         xIdx++,
      })
    }
  })

  return result
}

const M = { top: 16, right: 56, bottom: 24, left: 8 }
const CHART_RATIO  = 0.70
const VOLUME_RATIO = 0.18

export default function PriceChart({ history, openPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize]         = useState({ w: 0, h: 0 })
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const gameStartPrice = openPrice
  const candles        = buildCandles(history, gameStartPrice)

  if (!candles.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-xs">
        분기를 진행하면 차트가 표시됩니다
      </div>
    )
  }

  const lastCandle = candles[candles.length - 1]
  const overallPct = ((lastCandle.close - gameStartPrice) / gameStartPrice) * 100

  // geometry
  const plotLeft   = M.left
  const plotRight  = size.w - M.right
  const plotTop    = M.top
  const plotBottom = size.h - M.bottom
  const plotW      = Math.max(0, plotRight - plotLeft)
  const plotH      = Math.max(0, plotBottom - plotTop)

  const chartH     = plotH * CHART_RATIO
  const chartTop   = plotTop
  const chartBot   = chartTop + chartH

  const volH       = plotH * VOLUME_RATIO
  const volBot     = plotBottom
  const volTop     = volBot - volH

  const N     = candles.length
  const slotW = N > 0 ? plotW / N : 0
  const bodyW = Math.max(2, slotW * 0.55)

  // price domain across all candles + game start
  const allPrices = candles.flatMap(c => [c.high, c.low])
  const priceMin  = Math.min(...allPrices, gameStartPrice)
  const priceMax  = Math.max(...allPrices, gameStartPrice)
  const pricePad  = (priceMax - priceMin) * 0.12 || priceMax * 0.05
  const yMin      = priceMin - pricePad
  const yMax      = priceMax + pricePad

  const toX  = (i: number) => plotLeft + (i + 0.5) * slotW
  const toY  = (p: number) => chartBot - chartH * ((p - yMin) / (yMax - yMin))

  const maxVol  = Math.max(...candles.map(c => c.volume))
  const toVolH  = (v: number) => Math.max(1, volH * (v / maxVol))

  const canDraw = size.w > 0 && plotH > 0 && N > 0

  const Y_TICKS  = 5
  const yTickVals = Array.from({ length: Y_TICKS }, (_, i) =>
    yMin + (yMax - yMin) * (i / (Y_TICKS - 1))
  )
  const fmtY = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
    : String(Math.round(n))

  const hovered = hoverIdx !== null ? candles[hoverIdx] : null

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canDraw) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = e.clientX - rect.left - plotLeft
    const idx  = Math.floor(mx / slotW)
    setHoverIdx(idx >= 0 && idx < N ? idx : null)
  }

  const tooltipW = 158
  const tooltipX = hoverIdx !== null
    ? toX(hoverIdx) + slotW / 2 + 6 + tooltipW > plotRight
      ? toX(hoverIdx) - slotW / 2 - 6 - tooltipW
      : toX(hoverIdx) + slotW / 2 + 6
    : 0

  return (
    <div className="h-full flex flex-col">
      {/* legend */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-1 text-xs text-gray-400 shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> 상승
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> 하락
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-dashed border-gray-400" />
          시작 {fmt(gameStartPrice)}
        </span>
        <span className="ml-auto">
          세션 전체&nbsp;
          <span className={overallPct >= 0 ? 'text-red-600' : 'text-blue-600'}>
            {fmtPct(overallPct)}
          </span>
        </span>
      </div>

      {/* chart */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {canDraw && (
          <svg
            width={size.w}
            height={size.h}
            onMouseMove={handleMouseMove}
            style={{ cursor: 'crosshair', display: 'block' }}
          >
            {/* grid lines + Y labels */}
            {yTickVals.map((val, i) => (
              <g key={i}>
                <line
                  x1={plotLeft} y1={toY(val)} x2={plotRight} y2={toY(val)}
                  stroke="#f3f4f6" strokeWidth={1}
                />
                <text
                  x={plotRight + 4} y={toY(val) + 3.5}
                  fill="#9ca3af" fontSize={10} textAnchor="start"
                >
                  {fmtY(val)}
                </text>
              </g>
            ))}

            {/* game-start baseline */}
            <line
              x1={plotLeft} y1={toY(gameStartPrice)}
              x2={plotRight} y2={toY(gameStartPrice)}
              stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 3"
            />

            {/* quarter boundary dividers */}
            {candles
              .filter(c => c.quarterLabel)
              .map(c => (
                <line
                  key={c.xIdx}
                  x1={toX(c.xIdx) + slotW / 2} y1={chartTop}
                  x2={toX(c.xIdx) + slotW / 2} y2={chartBot}
                  stroke="#e5e7eb" strokeWidth={1} strokeDasharray="2 3"
                />
              ))
            }

            {/* hover column */}
            {hoverIdx !== null && (
              <rect
                x={plotLeft + hoverIdx * slotW} y={plotTop}
                width={slotW} height={plotH}
                fill="#f3f4f6" opacity={0.65}
              />
            )}

            {/* volume bars */}
            {candles.map(c => (
              <rect
                key={c.xIdx}
                x={toX(c.xIdx) - bodyW / 2}
                y={volBot - toVolH(c.volume)}
                width={bodyW}
                height={toVolH(c.volume)}
                fill={c.isUp ? '#fca5a5' : '#93c5fd'}
                opacity={0.7}
              />
            ))}

            {/* volume / chart separator */}
            <line
              x1={plotLeft} y1={volTop - 6}
              x2={plotRight} y2={volTop - 6}
              stroke="#e5e7eb" strokeWidth={1}
            />

            {/* candlesticks */}
            {candles.map(c => {
              const x       = toX(c.xIdx)
              const openY   = toY(c.open)
              const closeY  = toY(c.close)
              const highY   = toY(c.high)
              const lowY    = toY(c.low)
              const bodyTop = Math.min(openY, closeY)
              const bodyHt  = Math.max(2, Math.abs(closeY - openY))
              const color   = c.isUp ? '#ef4444' : '#3b82f6'
              return (
                <g key={c.xIdx}>
                  <line x1={x} y1={highY} x2={x} y2={lowY}
                    stroke={color} strokeWidth={1} />
                  <rect
                    x={x - bodyW / 2} y={bodyTop}
                    width={bodyW} height={bodyHt}
                    fill={color}
                  />
                </g>
              )
            })}

            {/* X labels — quarter boundaries only */}
            {candles
              .filter(c => c.quarterLabel)
              .map(c => (
                <text
                  key={c.xIdx}
                  x={toX(c.xIdx)} y={plotBottom + 14}
                  fill="#9ca3af" fontSize={10} textAnchor="middle"
                >
                  {c.quarterLabel}
                </text>
              ))
            }
          </svg>
        )}

        {/* tooltip */}
        {hovered && hoverIdx !== null && (
          <div
            className="absolute pointer-events-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-sm"
            style={{ top: M.top + 4, left: tooltipX, minWidth: tooltipW }}
          >
            {hovered.quarterLabel && (
              <div className="font-semibold text-gray-700 mb-1.5">{hovered.quarterLabel} 종가</div>
            )}
            {[
              { label: '시가', value: fmt(hovered.open),  cls: '' },
              { label: '종가', value: fmt(hovered.close), cls: hovered.isUp ? 'text-red-600' : 'text-blue-600' },
              { label: '고가', value: fmt(hovered.high),  cls: 'text-red-500' },
              { label: '저가', value: fmt(hovered.low),   cls: 'text-blue-500' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="text-gray-400">{label}</span>
                <span className={cls || 'text-gray-800'}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 mt-1.5 pt-1.5 border-t border-gray-100">
              <span className="text-gray-400">등락</span>
              <span className={`font-medium ${hovered.isUp ? 'text-red-600' : 'text-blue-600'}`}>
                {fmtPct(((hovered.close - hovered.open) / hovered.open) * 100)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
