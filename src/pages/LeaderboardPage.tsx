import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleAlert, Loader2 } from 'lucide-react'
import { fetchLeaderboard, type LeaderboardData, type LeaderboardRow } from '../services/contest'
import { isContestServerConfigured } from '../lib/supabase'
import { RankBadge } from '../components/modals/QuarterBreakModal'

const REFRESH_MS = 10_000   // 10초마다 순위를 새로 가져온다
const fmt = (n: number | null) => (n === null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`)
const pctColor = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? 'text-mute' : n > 0 ? 'text-up' : 'text-down')

// 가로로 밀어도 순위와 이름은 고정해서 보이게 한다 (순위 칸 너비 = 56px)
const RANK_W = 'w-14 min-w-14 max-w-14'

/**
 * 대회 순위표 — 관리자만 볼 수 있다 (App 의 경로 보호). 대회는 관리자 화면에서 골라 들어온다.
 * 일반 참가자는 분기가 넘어갈 때 뜨는 순위 팝업으로만 순위를 본다.
 */
export default function LeaderboardPage() {
  const [params] = useSearchParams()
  const code = (params.get('code') ?? '').trim().toUpperCase()

  const [data, setData]         = useState<LeaderboardData | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [onlyDone, setOnlyDone] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!code) return
    setLoading(true)
    try {
      setData(await fetchLeaderboard(code))
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : '순위표를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    if (!code || !isContestServerConfigured) return
    load()
    const id = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [code, load])

  const all   = data?.players ?? []
  const total = data?.contest.quarters ?? 0
  // 순위는 전체 목록에서의 위치다 (필터로 숨겨도 순위는 그대로)
  const rows: { p: LeaderboardRow; rank: number }[] = all
    .map((p, i) => ({ p, rank: i + 1 }))
    .filter(({ p }) => !onlyDone || p.finished)
  const quarterCols = Array.from({ length: total }, (_, i) => i)

  const statusText = !data ? '' :
    data.contest.status === 'lobby'    ? `대기 중, 참가자 ${all.length}명` :
    data.contest.status === 'running'  ? `${data.contest.current_round} / ${data.contest.quarters}분기 진행 중` :
                                         '대회가 끝났습니다'

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col px-5 sm:px-10 pt-7 pb-5">
      <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col">

        <div className="flex justify-between items-center text-[13px] pb-2.5 border-b border-ink">
          <Link to="/admin/contests" className="text-ink hover:underline">← 대회 관리</Link>
          <span>shiftStocks</span>
        </div>

        <div className="text-center pt-5 pb-4 border-b-4 border-double border-ink">
          <h1 className="font-serif font-black text-[clamp(36px,7vw,64px)] leading-none tracking-tight m-0">대회 순위표</h1>
          {data && (
            <p className="m-0 mt-3 text-ink-soft text-sm">
              {data.contest.title || data.contest.code}, 전체 {total}분기
            </p>
          )}
          {data && <p className="m-0 mt-1 text-sm font-bold">{statusText}</p>}
        </div>

        {!isContestServerConfigured && (
          <p className="flex items-start gap-1.5 text-up text-sm pt-5 m-0" role="alert">
            <CircleAlert size={14} className="mt-0.5 shrink-0" />
            대회 서버가 설정되지 않아 순위표를 볼 수 없습니다.
          </p>
        )}

        {isContestServerConfigured && !code && (
          <p className="text-mute text-sm pt-8 m-0 text-center">
            대회 관리 화면에서 대회를 골라 순위표를 열어 주세요.{' '}
            <Link to="/admin/contests" className="text-ink underline underline-offset-2">대회 관리로 가기</Link>
          </p>
        )}

        {error && (
          <p className="flex items-start gap-1.5 text-up text-sm pt-5 m-0" role="alert">
            <CircleAlert size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {data && (
          <section className="pt-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
              <label className="flex items-center gap-2 cursor-pointer text-ink-soft text-sm">
                <input type="checkbox" checked={onlyDone} onChange={e => setOnlyDone(e.target.checked)} />
                끝까지 마친 참가자만 보기
              </label>
              <span className="flex items-center gap-1.5">
                {loading && <Loader2 size={12} className="animate-spin" />}
                {updatedAt ? `${updatedAt.toLocaleTimeString('ko-KR')} 기준, 10초마다 갱신` : ''}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="text-mute text-sm py-8 m-0 text-center">
                {onlyDone ? '아직 끝까지 마친 참가자가 없습니다.' : '아직 참가자가 없습니다.'}
              </p>
            ) : (
              <div className="overflow-x-auto border-y border-ink">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-mute text-left">
                      <th className={`sticky left-0 z-10 bg-paper border-b-2 border-ink pb-2 pt-2 pl-1 font-medium ${RANK_W}`}>순위</th>
                      <th className="sticky left-14 z-10 bg-paper border-b-2 border-ink border-r border-r-rule pb-2 pt-2 pr-4 font-medium min-w-28">이름</th>
                      <th className="border-b-2 border-ink pb-2 pt-2 pr-4 font-medium text-right whitespace-nowrap">진행</th>
                      <th className="border-b-2 border-ink pb-2 pt-2 pr-4 font-medium text-right whitespace-nowrap">총 자산</th>
                      <th className="border-b-2 border-ink pb-2 pt-2 pr-5 font-medium text-right whitespace-nowrap">수익률</th>
                      {quarterCols.map(i => (
                        <th key={i} scope="col" title={`${i + 1}분기 마감 시점의 누적 수익률`} className="border-b-2 border-l border-ink border-l-rule pb-2 pt-2 px-3 font-medium text-right whitespace-nowrap">
                          {i + 1}분기
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ p, rank }) => {
                      const pct = p.return_pct
                      const top = rank <= 3
                      const rowBg = rank === 1 ? 'bg-paper-card' : 'bg-paper'
                      const pad = rank === 1 ? 'py-4' : rank <= 3 ? 'py-3.5' : 'py-3'
                      const edge = rank === 1 ? 'border-b-2 border-ink' : 'border-b border-rule'
                      return (
                        <tr key={p.nickname}>
                          <td className={`sticky left-0 z-10 ${rowBg} ${edge} ${pad} pl-1 ${RANK_W}`}><RankBadge rank={rank} /></td>
                          <td className={`sticky left-14 z-10 ${rowBg} ${edge} border-r border-r-rule ${pad} pr-4 min-w-28 ${top ? 'font-serif font-black text-base' : 'font-medium'}`}>
                            {p.nickname}
                          </td>
                          <td className={`${rowBg} ${edge} ${pad} pr-4 text-right whitespace-nowrap text-ink-soft`}>
                            {p.forfeited_quarter != null
                              ? <span className="font-bold text-up">{p.forfeited_quarter}분기 포기</span>
                              : p.finished ? <span className="font-bold text-ink">완료</span> : `${p.quarter} / ${total}분기`}
                          </td>
                          <td className={`${rowBg} ${edge} ${pad} pr-4 text-right tabular-nums whitespace-nowrap ${top ? 'font-bold' : ''}`}>{fmt(p.total_assets)}</td>
                          <td className={`${rowBg} ${edge} ${pad} pr-5 text-right font-bold tabular-nums whitespace-nowrap ${top ? 'text-base' : ''} ${pctColor(pct)}`}>
                            {pct === null ? '-' : `${pct > 0 ? '▲' : pct < 0 ? '▼' : '–'} ${Math.abs(pct).toFixed(2)}%`}
                          </td>
                          {quarterCols.map(i => {
                            const v = p.quarter_returns?.[i] ?? null
                            const forfeitedHere = p.forfeited_quarter === i + 1
                            return (
                              <td key={i} className={`${rowBg} ${edge} ${pad} px-3 border-l border-l-rule text-right tabular-nums whitespace-nowrap ${forfeitedHere ? "text-up font-bold" : pctColor(v)}`}>
                                {forfeitedHere ? "포기" : fmtPct(v)}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="m-0 text-xs text-mute leading-relaxed">
              분기별 칸은 각 분기를 마감한 시점의 <b className="text-ink-soft">누적 수익률</b>(시작 자본 대비)입니다. 아직 지나지 않은 분기와 기록이 없는 분기는 –로 표시됩니다.
              순위는 가장 최근 수익률 기준이고, 모든 참가자가 같은 분기를 함께 진행합니다.
            </p>
          </section>
        )}
      </div>

      <footer className="pt-3 mt-6 border-t border-ink text-center text-xs text-mute">
        © 2026 aishift. All rights reserved.
      </footer>
    </div>
  )
}
