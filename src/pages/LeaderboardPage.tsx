import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleAlert, Loader2 } from 'lucide-react'
import { fetchLeaderboard, hostStartContest, hostForceNext, type LeaderboardData } from '../services/contest'
import { isContestServerConfigured } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'

const REFRESH_MS = 10_000   // 10초마다 순위를 새로 가져온다
const fmt = (n: number | null) => (n === null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)

/** 대회 순위표 — 로그인 없이 대회 코드만으로 볼 수 있다 */
export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const code = (params.get('code') ?? '').trim().toUpperCase()

  const myName    = useGameStore(s => s.userName)
  const myContest = useGameStore(s => s.contest)
  const ready     = useGameStore(s => s.phase !== 'setup')

  const [input, setInput]       = useState(code)
  const [data, setData]         = useState<LeaderboardData | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [onlyDone, setOnlyDone] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [hostKey, setHostKey]   = useState('')
  const [hostMsg, setHostMsg]   = useState<{ text: string; error: boolean } | null>(null)
  const [hostBusy, setHostBusy] = useState(false)

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

  const isMine = (nick: string) => myContest?.code === code && nick === myName
  const rows = (data?.players ?? []).filter(p => !onlyDone || p.finished)
  const total = data?.contest.quarters ?? 0

  const runHost = async (fn: (code: string, key: string) => Promise<void>, done: string) => {
    if (!code) return
    if (!hostKey.trim()) { setHostMsg({ text: '진행자 키를 입력해 주세요.', error: true }); return }
    setHostBusy(true)
    try {
      await fn(code, hostKey.trim())
      setHostMsg({ text: done, error: false })
      await load()
    } catch (err) {
      setHostMsg({ text: err instanceof Error ? err.message : '실패했습니다.', error: true })
    } finally {
      setHostBusy(false)
    }
  }

  const statusText = !data ? '' :
    data.contest.status === 'lobby'    ? `대기 중, 참가자 ${data.players.length}명` :
    data.contest.status === 'running'  ? `${data.contest.current_round} / ${data.contest.quarters}분기 진행 중` :
                                         '대회가 끝났습니다'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = input.trim().toUpperCase()
    if (next) setParams({ code: next })
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col px-5 sm:px-10 pt-7 pb-5">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">

        <div className="flex justify-between items-center text-[13px] pb-2.5 border-b border-ink">
          <Link to={ready ? '/' : '/setup'} className="text-ink hover:underline">← {ready ? '게임으로 돌아가기' : '처음으로'}</Link>
          <span>shiftStocks</span>
        </div>

        <div className="text-center pt-5 pb-4 border-b-4 border-double border-ink">
          <h1 className="font-serif font-black text-[clamp(36px,7vw,64px)] leading-none tracking-tight m-0">대회 순위표</h1>
          {data && (
            <p className="m-0 mt-3 text-ink-soft text-sm">
              {data.contest.title || data.contest.code}, 전체 {total}분기
            </p>
          )}
          {data && (
            <p className="m-0 mt-1 text-sm font-bold">{statusText}</p>
          )}
        </div>

        {/* 대회 코드 입력 */}
        <form onSubmit={submit} className="flex gap-2 pt-5">
          <label htmlFor="lb-code" className="sr-only">대회 코드</label>
          <input
            id="lb-code"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="대회 코드를 입력하세요"
            autoComplete="off"
            className="flex-1 min-w-0 h-11 bg-transparent border-0 border-b border-ink px-1 text-[17px] focus:outline-none placeholder:text-mute/60"
          />
          <button type="submit" className="h-11 px-5 bg-ink hover:bg-ink-soft text-paper text-sm font-bold transition-colors">
            순위 보기
          </button>
        </form>

        {!isContestServerConfigured && (
          <p className="flex items-start gap-1.5 text-up text-sm pt-5 m-0" role="alert">
            <CircleAlert size={14} className="mt-0.5 shrink-0" />
            대회 서버가 설정되지 않아 순위표를 볼 수 없습니다.
          </p>
        )}

        {isContestServerConfigured && !code && (
          <p className="text-mute text-sm pt-8 m-0 text-center">참가한 대회의 코드를 입력하면 순위가 나타납니다.</p>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-mute border-b-2 border-ink text-left">
                      <th className="pb-2 font-medium w-14">순위</th>
                      <th className="pb-2 font-medium">이름</th>
                      <th className="pb-2 font-medium text-right whitespace-nowrap">진행</th>
                      <th className="pb-2 pl-4 font-medium text-right">총 자산</th>
                      <th className="pb-2 pl-4 font-medium text-right">수익률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p, i) => {
                      const pct  = p.return_pct
                      const mine = isMine(p.nickname)
                      return (
                        <tr key={p.nickname} className={`border-b border-rule ${mine ? 'bg-paper-deep' : ''}`}>
                          <td className="py-3 font-serif font-black text-lg">{i + 1}</td>
                          <td className="py-3 font-medium">
                            {p.nickname}
                            {mine && <span className="ml-1.5 text-[11px] text-mute">나</span>}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap text-ink-soft">
                            {p.finished ? <span className="font-bold text-ink">완료</span> : `${p.quarter} / ${total}분기`}
                          </td>
                          <td className="py-3 pl-4 text-right tabular-nums">{fmt(p.total_assets)}</td>
                          <td className={`py-3 pl-4 text-right font-bold tabular-nums ${pct !== null && pct > 0 ? 'text-up' : pct !== null && pct < 0 ? 'text-down' : 'text-mute'}`}>
                            {pct === null ? '-' : `${pct > 0 ? '▲' : pct < 0 ? '▼' : '–'} ${Math.abs(pct).toFixed(2)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <details className="border-t border-ink pt-3">
              <summary className="cursor-pointer text-sm text-mute hover:text-ink">진행자 메뉴</summary>
              <div className="pt-3 flex flex-col gap-3">
                <label htmlFor="host-key" className="text-sm text-ink-soft">진행자 키</label>
                <input
                  id="host-key"
                  type="password"
                  value={hostKey}
                  onChange={e => setHostKey(e.target.value)}
                  autoComplete="off"
                  className="h-11 bg-transparent border-0 border-b border-ink px-1 text-[16px] focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {data.contest.status === 'lobby' && (
                    <button
                      onClick={() => runHost(hostStartContest, '대회를 시작했습니다. 참가자 화면에서 1분기가 열립니다.')}
                      disabled={hostBusy || data.players.length === 0}
                      className="h-11 px-5 bg-up hover:brightness-110 disabled:bg-rule disabled:text-mute text-white text-sm font-bold transition"
                    >
                      대회 시작 ({data.players.length}명)
                    </button>
                  )}
                  {data.contest.status === 'running' && (
                    <button
                      onClick={() => { if (window.confirm('지금 분기를 바로 닫고 다음 분기로 넘길까요? 아직 마감하지 않은 참가자는 페널티를 받습니다.')) runHost(hostForceNext, '다음 분기로 넘겼습니다.') }}
                      disabled={hostBusy}
                      className="h-11 px-5 border border-ink hover:bg-paper-deep disabled:opacity-50 text-sm font-bold transition-colors"
                    >
                      지금 다음 분기로 넘기기
                    </button>
                  )}
                  {data.contest.status === 'finished' && <p className="m-0 text-sm text-mute">대회가 끝났습니다.</p>}
                </div>
                {hostMsg && (
                  <p className={`m-0 text-sm ${hostMsg.error ? 'text-up' : 'text-ink'}`} role={hostMsg.error ? 'alert' : 'status'}>{hostMsg.text}</p>
                )}
              </div>
            </details>
            <p className="m-0 text-xs text-mute leading-relaxed">
              모든 참가자가 같은 분기를 함께 진행하고, 분기가 넘어갈 때마다 수익률이 바뀝니다. 최종 순위는 대회가 끝난 뒤의 순위입니다.
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
