import { useEffect, useRef, useState } from 'react'
import {
  ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Bar, Line,
} from 'recharts'
import type { PricePoint } from '../../types'

interface Props {
  history:   PricePoint[]
  openPrice: number
}

interface PlotPoint {
  key:           string
  idx:           number
  price:         number
  quarterLabel?: string
  isStart?:      boolean
  isQuarterEnd?: boolean
  dir?:          'up' | 'down'
}

const fmt    = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const STEPS  = 24

// Recharts ComposedChart에 넘기는 margin / YAxis 폭 — 오버레이 좌표 계산에도 동일하게 사용
const CM   = { top: 16, right: 24, bottom: 16, left: 0 } as const
const YAXW = 44   // YAxis width prop

function seededWave(from: number, to: number, steps: number, seed: number): number[] {
  const amplitude = Math.abs(to - from) || from * 0.03
  const result: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t        = i / steps
    const base     = from + (to - from) * t
    const envelope = Math.sin(t * Math.PI)
    const noise    = (
      Math.sin(seed * 13.7 + i * 2.3) * 0.12 +
      Math.sin(seed *  7.1 + i * 1.7) * 0.08 +
      Math.cos(seed *  3.9 + i * 3.1) * 0.05 +
      Math.cos(seed * 11.3 + i * 0.7) * 0.04
    ) * amplitude * envelope
    result.push(Math.max(100, Math.round(base + noise)))
  }
  return result
}

function buildPlotPoints(history: PricePoint[], gameStartPrice: number): PlotPoint[] {
  const quarterly = history.filter(p => p.quarterLabel)
  if (!quarterly.length) return []

  const points: PlotPoint[] = []
  let idx = 0

  points.push({ key: '0', idx: idx++, price: gameStartPrice, isStart: true })

  quarterly.forEach((q, qi) => {
    const from = qi === 0 ? gameStartPrice : quarterly[qi - 1].price
    const to   = q.price
    const dir: 'up' | 'down' = to >= from ? 'up' : 'down'
    const prices = seededWave(from, to, STEPS, qi + 1)

    // prices[0] = from (이미 추가) → i=1부터
    for (let i = 1; i < prices.length; i++) {
      const isEnd = i === prices.length - 1
      points.push({
        key:          String(idx),
        idx:          idx++,
        price:        prices[i],
        quarterLabel: isEnd ? q.quarterLabel : undefined,
        isQuarterEnd: isEnd,
        dir,
      })
    }
  })

  return points
}

export default function PriceChart({ history, openPrice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

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

  if (!history.length) return null

  const gameStartPrice = openPrice
  const plotPoints     = buildPlotPoints(history, gameStartPrice)

  if (!plotPoints.length) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-xs">
        분기를 진행하면 차트가 표시됩니다
      </div>
    )
  }

  const prices     = plotPoints.map(p => p.price)
  const minP       = Math.min(...prices)
  const maxP       = Math.max(...prices)
  const pad        = (maxP - minP) * 0.35 || maxP * 0.12
  const yMin       = minP - pad
  const yMax       = maxP + pad

  const lastPt     = plotPoints[plotPoints.length - 1]
  const overallPct = ((lastPt.price - gameStartPrice) / gameStartPrice) * 100

  // ── 오버레이 픽셀 좌표 계산 ─────────────────────────────────────────────
  const plotLeft   = CM.left + YAXW
  const plotRight  = size.w - CM.right
  const plotTop    = CM.top
  const plotBottom = size.h - CM.bottom
  const plotW      = Math.max(0, plotRight - plotLeft)
  const plotH      = Math.max(0, plotBottom - plotTop)
  const N          = plotPoints.length
  const bandW      = N > 0 ? plotW / N : 0

  const toX = (p: PlotPoint) => plotLeft + (p.idx + 0.5) * bandW
  const toY = (price: number) =>
    plotH > 0
      ? plotTop + plotH * (1 - (price - yMin) / (yMax - yMin))
      : plotTop

  const canDraw = size.w > 0 && plotH > 0 && bandW > 0

  return (
    <div className="h-full flex flex-col">
      {/* 범례 */}
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

      {/* 차트 영역 — Recharts(축·툴팁) + SVG 오버레이(선·마커) */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plotPoints} margin={CM}>
            <XAxis
              dataKey="key"
              interval={0}
              tick={(props: any) => {
                const { x, y, payload } = props
                const p = plotPoints.find(pt => pt.key === String(payload.value) && pt.quarterLabel)
                if (!p?.quarterLabel) return <g key={payload.value} />
                return (
                  <text key={payload.value} x={x} y={y + 14} textAnchor="middle" fill="#9ca3af" fontSize={11}>
                    {p.quarterLabel}
                  </text>
                )
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={n =>
                n >= 1_000_000
                  ? `${(n / 1_000_000).toFixed(1)}M`
                  : n >= 1_000
                  ? `${(n / 1_000).toFixed(0)}K`
                  : String(Math.round(n))
              }
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={YAXW}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]?.payload as PlotPoint
                if (!p) return null
                return (
                  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs flex flex-col gap-1 min-w-[140px] shadow-sm">
                    {p.isStart && <span className="text-gray-500 font-semibold">게임 시작가</span>}
                    {p.quarterLabel && <span className="text-gray-500 font-semibold">{p.quarterLabel} 종가</span>}
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400">가격</span>
                      <span className="text-gray-900">{fmt(p.price)}</span>
                    </div>
                  </div>
                )
              }}
            />
            {/* band scale 초기화 */}
            <Bar dataKey="price" opacity={0} isAnimationActive={false} />
            {/* 툴팁 히트 영역 (마우스 감지용 투명 선) */}
            <Line dataKey="price" stroke="transparent" strokeWidth={12} dot={false} activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* SVG 오버레이 — Recharts 내부 API 불필요, 픽셀 좌표 직접 계산 */}
        {canDraw && (
          <svg
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            width={size.w}
            height={size.h}
          >
            {/* 시작가 수평 기준선 */}
            <line
              x1={plotLeft}  y1={toY(gameStartPrice)}
              x2={plotRight} y2={toY(gameStartPrice)}
              stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3"
            />

            {/* 세그먼트별 색상 라인: 이전 → 현재 포인트 가격 비교 */}
            {plotPoints.slice(1).map((p, i) => {
              const prev  = plotPoints[i]
              const color = p.price > prev.price ? '#ef4444' : '#3b82f6'
              return (
                <line
                  key={i}
                  x1={toX(prev)} y1={toY(prev.price)}
                  x2={toX(p)}    y2={toY(p.price)}
                  stroke={color} strokeWidth={1.5}
                />
              )
            })}

            {/* 게임 시작 마커 */}
            <circle
              cx={toX(plotPoints[0])} cy={toY(gameStartPrice)}
              r={5} fill="#9ca3af" stroke="#e5e7eb" strokeWidth={1.5}
            />

            {/* 분기 종가 마커 */}
            {plotPoints.filter(p => p.isQuarterEnd).map((p, i) => (
              <circle
                key={i}
                cx={toX(p)} cy={toY(p.price)}
                r={4}
                fill={p.dir === 'up' ? '#ef4444' : '#3b82f6'}
                stroke="#e5e7eb" strokeWidth={1.5}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
