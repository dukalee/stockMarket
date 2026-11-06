import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Check, LogOut } from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { useGameStore } from '../stores/gameStore'
import { isContestServerConfigured } from '../lib/supabase'
import { loadAdminKey, saveAdminKey } from '../utils/adminKey'
import { MAX_CONTEST_QUARTERS } from '../utils/constants'
import {
  adminCloseContest, adminDeleteContest, adminForceNext, adminListContests, adminStartContest,
  createContest, fetchLeaderboard, ContestError,
  type AdminContestRow, type CreatedContest, type LeaderboardData,
} from '../services/contest'

const fmtWon = (n: number | null) => (n === null ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)
const fmtPct = (n: number | null) => (n === null ? '-' : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`)
const pctColor = (n: number | null) => (n === null || n === 0 ? 'text-ink' : n > 0 ? 'text-up' : 'text-down')

const inputCls = 'bg-paper border border-ink min-h-10 px-3 py-2 text-ink placeholder:text-mute w-full'
const btnCls = 'min-h-9 px-3 border border-ink text-ink text-sm font-bold hover:bg-paper-deep disabled:opacity-40'
const REFRESH_MS = 5_000

function CopyField({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* 복사 권한이 없으면 직접 선택해서 복사 */ }
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-mute text-xs font-bold">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={e => e.currentTarget.select()} className={`${inputCls} font-mono text-sm`} />
        <button type="button" onClick={copy} className="shrink-0 min-h-10 px-3 border border-ink text-ink text-sm font-bold flex items-center gap-1.5 hover:bg-paper-deep">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      {note && <p className="text-mute text-xs">{note}</p>}
    </div>
  )
}

const STATUS_LABEL = { lobby: '대기실', running: '진행 중', finished: '종료' } as const

/** 관리자: 대회를 만들고, 목록에서 시작·넘기기·닫기를 한다. 모든 동작은 서버가 관리자 키를 확인한다. */
export default function AdminContestsPage() {
  const navigate = useNavigate()

  const [adminKey, setAdminKey]   = useState(loadAdminKey)      // 확인된 키 (없으면 잠금 화면)
  const [keyInput, setKeyInput]   = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockErr, setUnlockErr] = useState<string | null>(null)

  const [contests, setContests]   = useState<AdminContestRow[] | null>(null)
  const [listErr, setListErr]     = useState<string | null>(null)
  const [busyCode, setBusyCode]   = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ text: string; error: boolean } | null>(null)

  // 종료된 대회의 결과 보기 (한 번에 하나만 펼친다)
  const [openCode, setOpenCode]       = useState<string | null>(null)
  const [board, setBoard]             = useState<LeaderboardData | null>(null)
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardErr, setBoardErr]       = useState<string | null>(null)

  const [title, setTitle]         = useState('')
  const [code, setCode]           = useState('')
  const [quarters, setQuarters]   = useState(8)
  const [minutes, setMinutes]     = useState(5)
  const [penalty, setPenalty]     = useState(25)
  const [creating, setCreating]   = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [created, setCreated]     = useState<CreatedContest | null>(null)

  const lock = useCallback((message?: string) => {
    saveAdminKey('')
    setAdminKey('')
    setContests(null)
    if (message) setUnlockErr(message)
  }, [])

  const refresh = useCallback(async () => {
    if (!adminKey) return
    try {
      setContests(await adminListContests(adminKey))
      setListErr(null)
    } catch (err) {
      if (err instanceof ContestError && err.code === 'wrong_admin_key') lock(err.message)
      else setListErr(err instanceof ContestError ? err.message : '목록을 불러오지 못했습니다.')
    }
  }, [adminKey, lock])

  useEffect(() => {
    if (!adminKey) return
    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [adminKey, refresh])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setUnlocking(true)
    setUnlockErr(null)
    try {
      await adminListContests(keyInput)      // 키가 맞는지 서버에 확인
      saveAdminKey(keyInput)
      setAdminKey(keyInput)
      setKeyInput('')
    } catch (err) {
      setUnlockErr(err instanceof ContestError ? err.message : '확인하지 못했습니다.')
    } finally {
      setUnlocking(false)
    }
  }

  const runAction = async (c: AdminContestRow, label: string, fn: (key: string, code: string) => Promise<void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusyCode(c.code)
    setActionMsg(null)
    try {
      await fn(adminKey, c.code)
      setActionMsg({ text: `${c.code}: ${label} 완료`, error: false })
      await refresh()
    } catch (err) {
      setActionMsg({ text: `${c.code}: ${err instanceof ContestError ? err.message : `${label}에 실패했습니다.`}`, error: true })
    } finally {
      setBusyCode(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateErr(null)
    try {
      const result = await createContest(adminKey, {
        title, code, quarters,
        roundSeconds: Math.round(minutes * 60),
        penaltyRate: penalty / 100,
      })
      setCreated(result)
      setTitle('')
      setCode('')
      await refresh()
    } catch (err) {
      setCreateErr(err instanceof ContestError ? err.message : '대회를 만들지 못했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const toggleResult = async (c: AdminContestRow) => {
    if (openCode === c.code) { setOpenCode(null); return }
    setOpenCode(c.code)
    setBoard(null)
    setBoardErr(null)
    setBoardLoading(true)
    try {
      setBoard(await fetchLeaderboard(c.code))
    } catch (err) {
      setBoardErr(err instanceof ContestError ? err.message : '결과를 불러오지 못했습니다.')
    } finally {
      setBoardLoading(false)
    }
  }

  const deleteFinished = (c: AdminContestRow) =>
    runAction(
      c, '삭제', adminDeleteContest,
      `"${c.title || c.code}" 대회와 참가자 ${c.players}명의 기록을 데이터베이스에서 영구 삭제합니다.\n되돌릴 수 없습니다. 계속할까요?`,
    )

  const active   = (contests ?? []).filter(c => c.status !== 'finished')
  const finished = (contests ?? []).filter(c => c.status === 'finished')

  // 순위표는 같은 탭에서 연다. 새 탭은 관리자 로그인이 이어지지 않아 로그인 화면으로 돌아가 버린다.
  const leaderboardPath = (c: string) => `/leaderboard?code=${encodeURIComponent(c)}`

  return (
    <AppShell>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between border-b border-rule px-6 py-3 shrink-0">
          <span className="text-ink-soft font-semibold text-sm">🔒 Admin · 대회 관리</span>
          <div className="flex items-center gap-4">
            {adminKey && (
              <button onClick={() => lock()} className="text-mute hover:text-ink text-sm">관리자 키 잠금</button>
            )}
            <button
              onClick={() => { lock(); useGameStore.getState().setAdminAuth(false); navigate('/admin') }}
              className="flex items-center gap-2 text-mute hover:text-ink text-sm transition-colors"
            >
              <LogOut size={14} />
              로그아웃
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">

            {!isContestServerConfigured && (
              <p className="border border-up text-up text-sm p-3">
                대회 서버가 연결되지 않았습니다. 배포 환경에 <b>VITE_SUPABASE_URL</b>, <b>VITE_SUPABASE_ANON_KEY</b>를 추가해 주세요.
              </p>
            )}

            {/* ── 잠금: 관리자 키 확인 ── */}
            {!adminKey && (
              <form onSubmit={handleUnlock} className="w-full max-w-md mx-auto bg-paper-card border border-ink p-6 flex flex-col gap-4">
                <h1 className="font-serif text-xl font-black text-ink">관리자 키 확인</h1>
                <p className="text-mute text-sm">서버에 등록한 관리자 키를 입력하면 대회를 만들고 관리할 수 있습니다. 이 탭을 닫으면 다시 입력해야 합니다.</p>
                <input
                  type="password" value={keyInput} autoFocus autoComplete="off"
                  onChange={e => { setKeyInput(e.target.value); setUnlockErr(null) }}
                  placeholder="관리자 키" className={inputCls}
                />
                {unlockErr && <p className="text-up text-sm">{unlockErr}</p>}
                <button
                  type="submit" disabled={unlocking || !keyInput || !isContestServerConfigured}
                  className="min-h-10 py-2.5 bg-ink text-paper font-bold text-sm hover:bg-ink-soft disabled:opacity-40"
                >
                  {unlocking ? '확인 중…' : '확인'}
                </button>
              </form>
            )}

            {adminKey && (
              // 넓은 화면: 왼쪽 새 대회 만들기 · 가운데 진행 중인 대회 · 오른쪽 종료된 대회 / 좁은 화면: 진행 중 → 만들기 → 종료 순으로 세로
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-8 items-start">
                {actionMsg && <p className={`text-sm m-0 lg:col-span-3 ${actionMsg.error ? 'text-up' : 'text-ink-soft'}`} role="status">{actionMsg.text}</p>}

                {/* ── 진행 중인 대회 (대기 중·진행 중) — 가운데 ── */}
                <section className="flex flex-col gap-3 min-w-0 lg:order-2">
                  <h1 className="font-serif text-xl font-black text-ink border-b-2 border-ink pb-2">진행 중인 대회</h1>
                  {listErr && <p className="text-up text-sm">{listErr}</p>}
                  {contests === null && !listErr && <p className="text-mute text-sm">불러오는 중…</p>}
                  {contests !== null && active.length === 0 && (
                    <p className="text-mute text-sm">
                      {finished.length > 0 ? '대기 중이거나 진행 중인 대회가 없습니다.' : '아직 만든 대회가 없습니다.'} 아래에서 새로 만들 수 있습니다.
                    </p>
                  )}

                  {active.map(c => {
                    const busy = busyCode === c.code
                    const last = c.status === 'running' && c.current_round >= c.quarters
                    return (
                      <div key={c.code} className="bg-paper-card border border-ink p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-serif text-base font-black text-ink">{c.title || '(이름 없음)'}</span>
                            <span className="font-mono text-sm text-ink-soft">{c.code}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <span className={`px-2 py-1 border ${c.status === 'running' ? 'border-up text-up' : 'border-ink text-ink'}`}>
                              {STATUS_LABEL[c.status]}
                              {c.status === 'running' && ` · ${c.current_round}/${c.quarters}분기`}
                            </span>
                            {!c.is_open && <span className="px-2 py-1 border border-rule text-mute">참가 닫힘</span>}
                          </div>
                        </div>
                        <p className="text-mute text-xs">
                          {[
                            c.status !== 'lobby' && `참가자 ${c.players}명`,
                            c.status === 'running' && `이번 분기 마감 ${c.done_players}/${c.players}명`,
                            `${c.quarters}분기`,
                            `분기당 ${Math.round(c.round_seconds / 60 * 10) / 10}분`,
                            `페널티 ${Math.round(Number(c.penalty_rate) * 100)}%`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                        {c.status === 'lobby' && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold text-ink">
                              대기 중 {c.players}명
                            </span>
                            {c.player_names?.length > 0 ? (
                              <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
                                {c.player_names.map(name => (
                                  <li key={name} className="px-2 py-0.5 border border-rule bg-paper text-xs text-ink">{name}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-mute text-xs">아직 아무도 들어오지 않았습니다. 학습자에게 대회 코드를 알려 주세요.</span>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {c.status === 'lobby' && (
                            <button
                              disabled={busy || c.players === 0}
                              onClick={() => runAction(c, '대회 시작', adminStartContest, `${c.players}명이 참가한 "${c.title || c.code}" 대회를 지금 시작할까요?\n시작하면 새로 참가할 수 없습니다.`)}
                              className="min-h-9 px-3 bg-ink text-paper text-sm font-bold hover:bg-ink-soft disabled:opacity-40"
                              title={c.players === 0 ? '참가자가 있어야 시작할 수 있습니다' : undefined}
                            >
                              대회 시작
                            </button>
                          )}
                          {c.status === 'running' && (
                            <button
                              disabled={busy}
                              onClick={() => runAction(c, last ? '마지막 분기 마감' : '다음 분기로', adminForceNext, last ? '마지막 분기를 지금 마감하고 대회를 끝낼까요?' : '지금 분기를 바로 마감하고 다음 분기로 넘길까요?\n마감하지 못한 참가자는 페널티를 받습니다.')}
                              className={btnCls}
                            >
                              {last ? '마지막 분기 마감' : '다음 분기로'}
                            </button>
                          )}
                          {c.is_open && c.status !== 'finished' && (
                            <button
                              disabled={busy}
                              onClick={() => runAction(c, '참가 닫기', adminCloseContest, '새 참가를 막을까요? 이미 들어온 참가자는 계속 진행합니다.')}
                              className={btnCls}
                            >
                              참가 닫기
                            </button>
                          )}
                          <Link to={leaderboardPath(c.code)} className={`${btnCls} inline-flex items-center`}>순위표 보기</Link>
                        </div>
                      </div>
                    )
                  })}
                </section>

                {/* ── 새 대회 만들기 — 왼쪽 ── */}
                <section className="flex flex-col gap-3 min-w-0 lg:order-1">
                  <h2 className="font-serif text-xl font-black text-ink border-b-2 border-ink pb-2">새 대회 만들기</h2>

                  {created && (
                    <div className="bg-paper-card border border-ink p-5 flex flex-col gap-3">
                      <p className="font-serif text-lg font-black text-ink">대회가 만들어졌습니다{created.title && ` — ${created.title}`}</p>
                      <CopyField label="대회 코드 (학습자에게 알려 주세요)" value={created.code} note="학습자는 첫 화면의 투자자 등록서에 이름과 이 코드를 입력합니다. 모두 들어오면 위 목록에서 대회 시작을 누르세요." />
                      <button onClick={() => setCreated(null)} className={`${btnCls} self-start`}>닫기</button>
                    </div>
                  )}

                  <form onSubmit={handleCreate} className="bg-paper-card border border-ink p-6 flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-mute text-sm font-bold">대회 이름</span>
                      <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="예: 1반 모의투자 대회" className={inputCls} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-mute text-sm font-bold">대회 코드 (비우면 자동 생성)</span>
                      <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={20} placeholder="영문 대문자·숫자 3~20자" className={`${inputCls} font-mono`} />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-mute text-sm font-bold">분기 수</span>
                        <input type="number" min={1} max={MAX_CONTEST_QUARTERS} value={quarters} onChange={e => setQuarters(Number(e.target.value))} className={inputCls} />
                        <span className="text-mute text-xs">최대 {MAX_CONTEST_QUARTERS}분기</span>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-mute text-sm font-bold">분기당 시간(분)</span>
                        <input type="number" min={0.5} max={60} step={0.5} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={inputCls} />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-mute text-sm font-bold">초과 페널티(%)</span>
                        <input type="number" min={0} max={100} value={penalty} onChange={e => setPenalty(Number(e.target.value))} className={inputCls} />
                      </label>
                    </div>
                    {createErr && <p className="text-up text-sm">{createErr}</p>}
                    <button
                      type="submit" disabled={creating}
                      className="min-h-10 py-2.5 bg-ink text-paper font-bold text-sm hover:bg-ink-soft disabled:opacity-40"
                    >
                      {creating ? '만드는 중…' : '대회 만들기'}
                    </button>
                  </form>
                </section>

                {/* ── 종료된 대회: 결과 보기, 데이터베이스에서 삭제 — 오른쪽 ── */}
                <section className="flex flex-col gap-3 min-w-0 lg:order-3">
                  <h2 className="font-serif text-xl font-black text-ink border-b-2 border-ink pb-2">
                    종료된 대회{contests !== null && ` (${finished.length})`}
                  </h2>
                  {contests !== null && finished.length === 0 && (
                    <p className="text-mute text-sm">종료된 대회가 없습니다. 마지막 분기가 마감되면 여기에 나타납니다.</p>
                  )}

                  {finished.map(c => {
                    const busy = busyCode === c.code
                    const open = openCode === c.code
                    return (
                      <div key={c.code} className="bg-paper-card border border-ink p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-serif text-base font-black text-ink">{c.title || '(이름 없음)'}</span>
                            <span className="font-mono text-sm text-ink-soft">{c.code}</span>
                          </div>
                          <span className="px-2 py-1 border border-rule text-mute text-xs font-bold">종료</span>
                        </div>
                        <p className="text-mute text-xs m-0">
                          {`참가자 ${c.players}명 · ${c.quarters}분기 · 분기당 ${Math.round(c.round_seconds / 60 * 10) / 10}분 · 페널티 ${Math.round(Number(c.penalty_rate) * 100)}%`}
                        </p>

                        <div className="flex gap-2 flex-wrap">
                          <button disabled={busy} onClick={() => toggleResult(c)} className={btnCls} aria-expanded={open}>
                            {open ? '결과 닫기' : '결과 보기'}
                          </button>
                          <Link to={leaderboardPath(c.code)} className={`${btnCls} inline-flex items-center`}>순위표 페이지</Link>
                          <button
                            disabled={busy}
                            onClick={() => deleteFinished(c)}
                            className="min-h-9 px-3 border border-up text-up text-sm font-bold hover:bg-paper-deep disabled:opacity-40 sm:ml-auto"
                          >
                            {busy ? '삭제 중…' : '데이터베이스에서 삭제'}
                          </button>
                        </div>

                        {open && (
                          <div className="border-t border-rule pt-3">
                            {boardLoading && <p className="text-mute text-sm m-0">불러오는 중…</p>}
                            {boardErr && <p className="text-up text-sm m-0">{boardErr}</p>}
                            {board && board.contest.code === c.code && (
                              board.players.length === 0 ? (
                                <p className="text-mute text-sm m-0">참가자 기록이 없습니다.</p>
                              ) : (
                                <table className="w-full text-sm border-collapse">
                                  <thead>
                                    <tr className="text-mute text-xs border-b-2 border-ink">
                                      <th className="py-2 pr-3 text-left font-bold w-12">순위</th>
                                      <th className="py-2 pr-3 text-left font-bold">이름</th>
                                      <th className="py-2 pl-3 text-right font-bold">최종 자산</th>
                                      <th className="py-2 pl-3 text-right font-bold">수익률</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {board.players.map((p, i) => (
                                      <tr key={p.nickname} className="border-b border-rule">
                                        <td className="py-2 pr-3 tabular-nums text-mute">{i + 1}</td>
                                        <td className="py-2 pr-3 font-bold text-ink">
                                          {p.nickname}
                                          {p.forfeited_quarter != null && <span className="ml-1.5 text-[11px] text-up font-bold">{p.forfeited_quarter}분기 포기</span>}
                                        </td>
                                        <td className="py-2 pl-3 text-right tabular-nums">{fmtWon(p.total_assets)}</td>
                                        <td className={`py-2 pl-3 text-right tabular-nums font-bold ${pctColor(p.return_pct)}`}>{fmtPct(p.return_pct)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
