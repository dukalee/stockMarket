import { useEffect, useMemo, useRef, useState } from 'react'
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
  quarterName:  string   // 이 캔들이 속한 분기 (예: 'Y1Q2')
  stepInQuarter: number  // 분기 내 순번 1~STEPS
  quarterLabel?: string  // 분기의 마지막 캔들에만 설정
  xIdx:         number
}

interface View {
  start: number  // 화면 왼쪽 끝에 해당하는 캔들 인덱스 (소수 허용 — 부드러운 확대·이동)
  count: number  // 화면에 보이는 캔들 수
}

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const STEPS  = 100  // 분기당 미니 캔들 수
const MIN_VISIBLE = 12

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 분기 시작가(from) → 종가(to)를 잇는 가격 경로.
 * 실제 주가처럼 보이도록
 *  - 변동성 군집(조용한 구간과 격렬한 구간이 번갈아 나타남)
 *  - 평균 회귀(오르면 곧 되돌리는 톱니 움직임)
 *  - 가끔 나오는 급등락(스파이크)
 *  - 분기 안의 큰 파동
 * 을 섞고, 마지막 값이 정확히 `to` 가 되도록 보정한다. (seed 가 같으면 항상 같은 모양)
 */
function seededWave(from: number, to: number, steps: number, seed: number): number[] {
  const mid  = (from + to) / 2
  const base = mid * 0.04    // 한 캔들의 기본 변동폭

  let rng = (seed * 1664525 + 1013904223) >>> 0
  const rand = () => {                       // -1 … 1 균등
    rng = (rng * 1664525 + 1013904223) >>> 0
    return (rng / 0x100000000) * 2 - 1
  }
  const gauss = () => rand() + rand() + rand()   // 종 모양에 가까운 분포 (표준편차 ≈ 1)

  const x = new Array(steps + 1).fill(0)
  for (let i = 1; i <= steps; i++) {
    const regime = 0.55 + 0.95 * Math.abs(Math.sin(i * 0.09 + seed * 1.7))
                              * (0.6 + 0.4 * Math.abs(Math.cos(i * 0.031 + seed * 0.9)))
    const spike  = (rand() + 1) / 2 > 0.95 ? 2.4 : 1
    x[i] = x[i - 1] * 0.8 + gauss() * base * regime * spike
  }

  const slowFreq = 1.3 + (seed % 3) * 0.5
  const endDrift = x[steps]

  return Array.from({ length: steps + 1 }, (_, i) => {
    const t      = i / steps
    const linear = from + (to - from) * t
    const wave   = mid * 0.06 * Math.sin(2 * Math.PI * t * slowFreq + seed) * Math.sin(Math.PI * t)
    return Math.max(100, Math.round(linear + x[i] - t * endDrift + wave))
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
    const mid    = (from + to) / 2
    const prices = seededWave(from, to, STEPS, qi + 1)

    for (let i = 0; i < prices.length - 1; i++) {
      const open  = prices[i]
      const close = prices[i + 1]

      const wickSeed  = qi * 1000 + i * 17 + 3
      const bodyRange = Math.abs(close - open)
      const wickRange = bodyRange * 0.5 + mid * 0.004 * (0.4 + Math.abs(Math.sin(wickSeed * 2.13)))
      const highExtra = Math.abs(Math.sin(wickSeed * 7.31)) * wickRange
      const lowExtra  = Math.abs(Math.sin(wickSeed * 11.73)) * wickRange

      // 큰 움직임일수록 거래량이 많다
      const volSeed = qi * 500 + i * 31
      const vol     = 0.2 + Math.abs(Math.sin(volSeed * 3.71)) * 0.5
                      + Math.min(0.6, (bodyRange / (mid * 0.03)) * 0.3)

      result.push({
        open,
        close,
        high:          Math.max(100, Math.round(Math.max(open, close) + highExtra)),
        low:           Math.max(100, Math.round(Math.min(open, close) - lowExtra)),
        volume:        vol,
        isUp:          close >= open,
        quarterName:   q.quarterLabel ?? '',
        stepInQuarter: i + 1,
        quarterLabel:  i === prices.length - 2 ? q.quarterLabel : undefined,
        xIdx:          xIdx++,
      })
    }
  })

  return result
}

function resolveView(v: View | null, n: number): View {
  const count = clamp(v?.count ?? Math.min(n, STEPS * 2), Math.min(MIN_VISIBLE, n), n)
  const start = clamp(v?.start ?? n - count, 0, n - count)
  return { start, count }
}

/** factor < 1 이면 확대, > 1 이면 축소. frac(0~1)은 화면 안에서 고정할 지점. */
function zoomView(prev: View | null, n: number, factor: number, frac: number): View {
  const cur    = resolveView(prev, n)
  const count  = clamp(cur.count * factor, Math.min(MIN_VISIBLE, n), n)
  const anchor = cur.start + frac * cur.count
  return resolveView({ start: anchor - frac * count, count }, n)
}

const M = { top: 16, right: 60, bottom: 24, left: 8 }
const CHART_RATIO  = 0.70
const VOLUME_RATIO = 0.18

const btn = 'h-7 min-w-7 px-2 border border-ink bg-transparent text-ink text-xs font-bold hover:bg-paper-deep transition-colors'

export default function PriceChart({ history, openPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize]   = useState({ w: 0, h: 0 })
  const [view, setView]   = useState<View | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ x0: number; start0: number } | null>(null)
  const geoRef  = useRef({ plotLeft: M.left, plotW: 0, n: 0 })

  const gameStartPrice = openPrice
  const candles        = useMemo(() => buildCandles(history, gameStartPrice), [history, gameStartPrice])
  const N              = candles.length
  const hasCandles     = N > 0

  // 새 분기 데이터가 들어오면 기본 보기(최근 구간)로 되돌린다
  useEffect(() => { setView(null) }, [N])

  // 차트 컨테이너는 캔들이 생긴 뒤에야 렌더링되므로, 그 시점에 다시 관찰을 시작해야 한다
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasCandles])

  // 마우스 휠 확대·축소 — 페이지가 같이 스크롤되지 않도록 passive: false 로 등록
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const g = geoRef.current
      if (g.n === 0 || g.plotW <= 0) return
      e.preventDefault()
      const rect   = el.getBoundingClientRect()
      const frac   = clamp((e.clientX - rect.left - g.plotLeft) / g.plotW, 0, 1)
      const factor = Math.exp(e.deltaY * 0.0015)   // 아래로 굴리면 축소, 위로 굴리면 확대
      setView(prev => zoomView(prev, g.n, factor, frac))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasCandles])

  if (!hasCandles) {
    return (
      <div className="h-full flex items-center justify-center text-mute text-xs">
        분기를 진행하면 차트가 표시됩니다
      </div>
    )
  }

  const cur = resolveView(view, N)

  const lastCandle = candles[N - 1]
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

  geoRef.current = { plotLeft, plotW, n: N }

  const slotW = plotW / cur.count
  const bodyW = clamp(slotW * 0.62, 1.5, 26)
  const toX   = (i: number) => plotLeft + (i - cur.start + 0.5) * slotW

  // 화면에 보이는 캔들만 그린다
  const i0  = Math.max(0, Math.floor(cur.start))
  const i1  = Math.min(N, Math.ceil(cur.start + cur.count))
  const vis = candles.slice(i0, i1)

  // 가격 범위는 보이는 구간 기준으로 자동 조정 (확대하면 세밀하게 보인다)
  const visHigh  = Math.max(...vis.map(c => c.high))
  const visLow   = Math.min(...vis.map(c => c.low))
  const pricePad = (visHigh - visLow) * 0.12 || visHigh * 0.05
  const yMin     = visLow - pricePad
  const yMax     = visHigh + pricePad
  const toY      = (p: number) => chartBot - chartH * ((p - yMin) / (yMax - yMin))

  const maxVol = Math.max(...vis.map(c => c.volume))
  const toVolH = (v: number) => Math.max(1, volH * (v / maxVol))

  const canDraw = size.w > 0 && plotH > 0

  const Y_TICKS   = 5
  const yTickVals = Array.from({ length: Y_TICKS }, (_, i) =>
    yMin + (yMax - yMin) * (i / (Y_TICKS - 1))
  )
  const fmtY = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
    : Math.round(n).toLocaleString('ko-KR')

  // 마우스 위치 → 캔들
  const inPlot = mouse !== null && mouse.x >= plotLeft && mouse.x <= plotRight
                 && mouse.y >= plotTop && mouse.y <= plotBottom
  const hoverIdx = inPlot && mouse
    ? Math.floor(cur.start + (mouse.x - plotLeft) / slotW)
    : null
  const hovered = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < N ? candles[hoverIdx] : null
  const crossPrice = inPlot && mouse && mouse.y <= chartBot
    ? yMax - ((mouse.y - chartTop) / chartH) * (yMax - yMin)
    : null

  const tooltipW = 164
  const tooltipX = hovered && hoverIdx !== null
    ? toX(hoverIdx) + slotW / 2 + 10 + tooltipW > plotRight
      ? toX(hoverIdx) - slotW / 2 - 10 - tooltipW
      : toX(hoverIdx) + slotW / 2 + 10
    : 0

  const lastY = toY(lastCandle.close)
  const lastVisible = i1 === N

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x0: e.clientX, start0: cur.start }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    const d = dragRef.current
    if (d && slotW > 0) {
      setView(resolveView({ start: d.start0 - (e.clientX - d.x0) / slotW, count: cur.count }, N))
    }
  }
  const endDrag = () => { dragRef.current = null; setDragging(false) }

  const zoomBy = (factor: number) => setView(prev => zoomView(prev, N, factor, 0.5))
  const showLast = (count: number) => setView(resolveView({ start: N - count, count }, N))

  return (
    <div className="h-full flex flex-col">
      {/* 범례 + 확대/축소 도구 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pt-3 pb-1 text-xs text-mute shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-up" /> 상승
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-down" /> 하락
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-dashed border-mute" />
          시작 {fmt(gameStartPrice)}
        </span>
        <span>
          세션 전체&nbsp;
          <span className={overallPct >= 0 ? 'text-up' : 'text-down'}>
            {fmtPct(overallPct)}
          </span>
        </span>

        <div className="ml-auto flex items-center gap-1" role="group" aria-label="차트 확대 축소">
          <button type="button" className={btn} onClick={() => showLast(Math.min(N, STEPS))}>1분기</button>
          <button type="button" className={btn} onClick={() => showLast(N)}>전체</button>
          <button type="button" className={btn} onClick={() => zoomBy(1 / 0.7)} aria-label="축소">−</button>
          <button type="button" className={btn} onClick={() => zoomBy(0.7)} aria-label="확대">+</button>
        </div>
      </div>

      {/* chart */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative select-none"
        onMouseLeave={() => { if (!dragging) setMouse(null) }}
      >
        {canDraw && (
          <svg
            width={size.w}
            height={size.h}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setView(null)}
            style={{ cursor: dragging ? 'grabbing' : 'crosshair', display: 'block', touchAction: 'none' }}
          >
            <defs>
              <clipPath id="pc-clip">
                <rect x={plotLeft} y={0} width={plotW} height={size.h} />
              </clipPath>
            </defs>

            {/* grid lines + Y labels */}
            {yTickVals.map((val, i) => (
              <g key={i}>
                <line
                  x1={plotLeft} y1={toY(val)} x2={plotRight} y2={toY(val)}
                  stroke="#dadad3" strokeWidth={1}
                />
                <text
                  x={plotRight + 4} y={toY(val) + 3.5}
                  fill="#4a4d54" fontSize={10} textAnchor="start"
                >
                  {fmtY(val)}
                </text>
              </g>
            ))}

            <g clipPath="url(#pc-clip)">
              {/* game-start baseline (보이는 가격 범위 안에 있을 때만) */}
              {gameStartPrice >= yMin && gameStartPrice <= yMax && (
                <line
                  x1={plotLeft} y1={toY(gameStartPrice)}
                  x2={plotRight} y2={toY(gameStartPrice)}
                  stroke="#8a8d94" strokeWidth={1} strokeDasharray="4 3"
                />
              )}

              {/* quarter boundary dividers */}
              {vis.filter(c => c.quarterLabel).map(c => (
                <line
                  key={c.xIdx}
                  x1={toX(c.xIdx) + slotW / 2} y1={chartTop}
                  x2={toX(c.xIdx) + slotW / 2} y2={volBot}
                  stroke="#c9c9c2" strokeWidth={1} strokeDasharray="2 3"
                />
              ))}

              {/* hover column */}
              {hovered && hoverIdx !== null && (
                <rect
                  x={toX(hoverIdx) - slotW / 2} y={plotTop}
                  width={slotW} height={plotH}
                  fill="#e4e4dd" opacity={0.65}
                />
              )}

              {/* volume bars */}
              {vis.map(c => (
                <rect
                  key={c.xIdx}
                  x={toX(c.xIdx) - bodyW / 2}
                  y={volBot - toVolH(c.volume)}
                  width={bodyW}
                  height={toVolH(c.volume)}
                  fill={c.isUp ? 'rgba(196,38,46,0.28)' : 'rgba(31,77,184,0.28)'}
                />
              ))}

              {/* volume / chart separator */}
              <line
                x1={plotLeft} y1={volTop - 6}
                x2={plotRight} y2={volTop - 6}
                stroke="#c9c9c2" strokeWidth={1}
              />

              {/* candlesticks */}
              {vis.map(c => {
                const x       = toX(c.xIdx)
                const openY   = toY(c.open)
                const closeY  = toY(c.close)
                const bodyTop = Math.min(openY, closeY)
                const bodyHt  = Math.max(1.5, Math.abs(closeY - openY))
                const color   = c.isUp ? '#c4262e' : '#1f4db8'
                return (
                  <g key={c.xIdx}>
                    <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)}
                      stroke={color} strokeWidth={1} />
                    <rect
                      x={x - bodyW / 2} y={bodyTop}
                      width={bodyW} height={bodyHt}
                      fill={color}
                    />
                  </g>
                )
              })}

              {/* 현재가선 */}
              {lastVisible && lastY >= chartTop && lastY <= chartBot && (
                <line
                  x1={plotLeft} y1={lastY} x2={plotRight} y2={lastY}
                  stroke={lastCandle.isUp ? '#c4262e' : '#1f4db8'}
                  strokeWidth={1} strokeDasharray="3 3" opacity={0.7}
                />
              )}

              {/* 십자선 */}
              {inPlot && mouse && !dragging && (
                <>
                  <line x1={mouse.x} y1={plotTop} x2={mouse.x} y2={plotBottom}
                    stroke="#14161a" strokeWidth={1} strokeDasharray="2 3" opacity={0.45} />
                  {crossPrice !== null && (
                    <line x1={plotLeft} y1={mouse.y} x2={plotRight} y2={mouse.y}
                      stroke="#14161a" strokeWidth={1} strokeDasharray="2 3" opacity={0.45} />
                  )}
                </>
              )}
            </g>

            {/* 현재가 태그 */}
            {lastVisible && lastY >= chartTop && lastY <= chartBot && (
              <g>
                <rect x={plotRight + 1} y={lastY - 8} width={M.right - 2} height={16}
                  fill={lastCandle.isUp ? '#c4262e' : '#1f4db8'} />
                <text x={plotRight + 5} y={lastY + 3.5} fill="#ffffff" fontSize={10} fontWeight={700}>
                  {fmtY(lastCandle.close)}
                </text>
              </g>
            )}

            {/* 십자선 가격 태그 */}
            {crossPrice !== null && mouse && !dragging && (
              <g>
                <rect x={plotRight + 1} y={mouse.y - 8} width={M.right - 2} height={16} fill="#14161a" />
                <text x={plotRight + 5} y={mouse.y + 3.5} fill="#f1f1ed" fontSize={10} fontWeight={700}>
                  {fmtY(crossPrice)}
                </text>
              </g>
            )}

            {/* X labels — quarter boundaries only */}
            {vis.filter(c => c.quarterLabel).map(c => (
              <text
                key={c.xIdx}
                x={clamp(toX(c.xIdx), plotLeft + 14, plotRight - 14)} y={plotBottom + 14}
                fill="#4a4d54" fontSize={10} textAnchor="middle"
              >
                {c.quarterLabel}
              </text>
            ))}
          </svg>
        )}

        {/* tooltip */}
        {hovered && hoverIdx !== null && !dragging && (
          <div
            className="absolute pointer-events-none bg-paper-card border border-ink px-3 py-2 text-xs"
            style={{ top: M.top + 4, left: tooltipX, minWidth: tooltipW }}
          >
            <div className="font-semibold text-ink mb-1.5">
              {hovered.quarterName} {hovered.stepInQuarter}/{STEPS} 구간
            </div>
            {[
              { label: '시가', value: fmt(hovered.open),  cls: '' },
              { label: '종가', value: fmt(hovered.close), cls: hovered.isUp ? 'text-up' : 'text-down' },
              { label: '고가', value: fmt(hovered.high),  cls: 'text-up' },
              { label: '저가', value: fmt(hovered.low),   cls: 'text-down' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="text-mute">{label}</span>
                <span className={cls || 'text-ink'}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 mt-1.5 pt-1.5 border-t border-rule">
              <span className="text-mute">등락</span>
              <span className={`font-medium ${hovered.isUp ? 'text-up' : 'text-down'}`}>
                {fmtPct(((hovered.close - hovered.open) / hovered.open) * 100)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
