import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleAlert, Loader2, Lock } from 'lucide-react'
import { useGameStore } from '../stores/gameStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { useMarketStore } from '../stores/marketStore'
import { generateQuarterNews } from '../engines/staticNewsEngine'
import { joinContest, ContestError } from '../services/contest'
import { flushPendingForfeits, isForfeitPending } from '../services/pendingForfeit'
import { usePendingForfeits } from '../hooks/usePendingForfeit'
import { isContestServerConfigured } from '../lib/supabase'
import { resetAllGameState } from '../services/gameReset'
import { useContestRoundStore } from '../stores/contestRoundStore'
import { SIMULATION_QUARTERS } from '../utils/constants'
import LivePriceBoard from '../components/title/LivePriceBoard'
import NewsRotator from '../components/title/NewsRotator'
import LiveChart from '../components/title/LiveChart'

const CAPITAL_PRESETS = [
  { label: '100만',  value: 1_000_000 },
  { label: '500만',  value: 5_000_000 },
  { label: '1000만', value: 10_000_000 },
  { label: '5000만', value: 50_000_000 },
]

function formatCapital(n: number) {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(0)}억`
  if (n >= 10_000)      return `₩${(n / 10_000).toFixed(0)}만`
  return `₩${n.toLocaleString('ko-KR')}`
}

const RULES = [
  {
    title: '분기마다 뉴스 8건 배달',
    body: '기사를 읽고 어느 종목이 움직일지 판단하세요. 모든 가격은 분기가 넘어갈 때 한꺼번에 바뀝니다.',
  },
  {
    title: '분산 투자가 진행 조건',
    body: '2개 종목, 2개 섹터 이상을 보유하고 지난 분기와 다른 포트폴리오여야 다음 분기로 넘어갈 수 있습니다.',
  },
  {
    title: '기사는 늘 맞지 않습니다',
    body: '제목과 본문의 방향이 다른 기사도 실립니다. 끝까지 읽어야 합니다.',
  },
]

export default function SetupPage() {
  const navigate = useNavigate()
  const adminAuth      = useGameStore(s => s.adminAuth)
  const pendingForfeits = usePendingForfeits()
  const phase          = useGameStore(s => s.phase)
  const mode           = useGameStore(s => s.mode)
  const contestInfo    = useGameStore(s => s.contest)
  const currentYear    = useGameStore(s => s.currentYear)
  const currentQuarter = useGameStore(s => s.currentQuarter)
  const startGame      = useGameStore(s => s.startGame)
  const enterLobby     = useGameStore(s => s.enterLobby)
  const initPortfolio  = usePortfolioStore(s => s.init)
  const resetMarket              = useMarketStore(s => s.resetMarket)
  const setNews                  = useMarketStore(s => s.setNews)
  const setNewsLoading           = useMarketStore(s => s.setNewsLoading)
  const setNewsLoadingProgress   = useMarketStore(s => s.setNewsLoadingProgress)

  // 진행 중이던 게임이 있으면 그 게임을 지키기 위해 새로 시작하는 양식을 보여주지 않는다
  const inLobby    = phase === 'lobby'
  const inProgress = phase === 'playing' || phase === 'advancing' || inLobby
  const isFinished = phase === 'finished'

  // 새 게임을 시작하기 직전(게임 없음)일 때만 시작가(현재가의 ±10%)를 새로 뽑는다
  useEffect(() => {
    if (phase === 'setup') resetMarket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const [userName,     setUserName]     = useState('')
  const [contestCode,  setContestCode]  = useState('')
  const [capitalInput, setCapitalInput] = useState('10000000')
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [starting,     setStarting]     = useState(false)

  const capital   = Number(capitalInput.replace(/,/g, '')) || 0
  const code      = contestCode.trim()
  const isContest = code.length > 0

  const validate = () => {
    const e: Record<string, string> = {}
    if (!userName.trim()) e.userName = '이름을 입력해주세요.'
    else if (isContest && userName.trim().length > 12) e.userName = '대회에서는 이름을 12자 이하로 입력해주세요.'
    if (!isContest && (!capital || capital < 100_000)) e.capital = '최소 ₩100,000 이상 입력해주세요.'
    if (isContest && !isContestServerConfigured) e.contestCode = '대회 서버가 설정되지 않았습니다. 대회 코드를 지우고 시뮬레이션으로 시작해주세요.'
    return e
  }

  const handleStart = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setErrors({})
    setStarting(true)
    setNewsLoading(true)
    setNewsLoadingProgress(0)

    try {
      if (isContest) {
        // 연결이 안 돼서 보내지 못한 포기가 있으면 먼저 보내 본다. 포기한 대회에는 다시 들어올 수 없다.
        await flushPendingForfeits()
        if (isForfeitPending(code, userName)) throw new ContestError('forfeited', '이미 포기한 대회입니다. 다시 참가할 수 없습니다.')
        // 서버에서 코드 확인 — 유효하고 대기실이 열려 있을 때만 시드와 설정을 받는다
        const join = await joinContest(code, userName)
        if (join.finished) throw new ContestError('already_finished', '이미 이 대회를 마친 이름입니다.')
        if (join.resumed && join.status !== 'lobby') {
          throw new ContestError('resumed_elsewhere', '이 이름으로 이미 참가한 기록이 있습니다. 진행하던 기기와 브라우저에서 이어서 해주세요.')
        }
        // 대기실로 입장 — 진행자가 시작하면 모두 동시에 1분기가 열린다 (뉴스는 그때 같은 시드로 만든다)
        useContestRoundStore.getState().clear()
        enterLobby({
          userName: userName.trim(),
          contest: join.contest,
          clockOffsetMs: join.serverTimeMs - Date.now(),
        })
        setNewsLoading(false)
        setStarting(false)
        navigate('/lobby')
        return
      } else {
        // 시뮬레이션: 대회 코드 없이 무작위 조건으로 4분기
        const news = await generateQuarterNews(1, 1, useMarketStore.getState().stocks, setNewsLoadingProgress)
        initPortfolio(capital)
        startGame({ userName: userName.trim(), initialCapital: capital, mode: 'simulation' })
        setNews(news)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setErrors({ general: msg })
      setNewsLoading(false)
      setNewsLoadingProgress(0)
      setStarting(false)
      return
    }

    setNewsLoadingProgress(8)
    setNewsLoading(false)
    setStarting(false)
    setTimeout(() => setNewsLoadingProgress(0), 400)
    navigate('/')
  }

  const handleCapitalInput = (val: string) => {
    setCapitalInput(val.replace(/[^0-9]/g, ''))
    setErrors(prev => ({ ...prev, capital: '' }))
  }

  const startOver = () => {
    if (window.confirm('진행 중인 게임을 버리고 새로 시작할까요? 되돌릴 수 없습니다.')) resetAllGameState()
  }

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col px-5 sm:px-10 lg:px-14 pt-7 pb-5">

      {/* 상단 발행 정보 */}
      <div className="flex justify-between items-center text-[13px] pb-2.5 border-b border-ink">
        <span className="flex items-center gap-4">
          <span>제 1호</span>
          <Link
            to={adminAuth ? '/admin/contests' : '/admin'}
            title="관리자 페이지"
            className="text-mute hover:text-ink inline-flex items-center gap-1.5"
          >
            <Lock size={15} />
            <span className="text-[13px] font-medium tracking-wide">Admin</span>
          </Link>
        </span>
        <span className="hidden sm:inline">{today}</span>
        <span>YEAR 1 Q1</span>
      </div>

      {pendingForfeits.length > 0 && (
        <p role="status" className="m-0 mt-2 text-center text-sm text-up">
          대회 포기 기록을 서버에 보내는 중입니다 ({pendingForfeits.map(p => p.code).join(', ')}). 연결되면 자동으로 기록됩니다.
        </p>
      )}

      {/* 제호 */}
      <div className="flex items-center justify-center pt-4 pb-3 border-b-4 border-double border-ink">
        <h1 className="font-serif font-black text-[clamp(52px,10vw,124px)] leading-[1.05] tracking-[-0.03em]">
          shiftStocks
        </h1>
      </div>

      {/* 본문: 위 3단(게임 규칙, 투자자 등록서, 오늘의 주가) + 아래 2단(오늘의 기사, 오늘의 차트) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.5fr)_minmax(320px,1fr)] pt-6">

        {/* 좌: 게임 규칙 */}
        <section className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 pt-8 lg:pt-0 lg:pr-7 lg:border-r border-ink flex flex-col">
          <h2 className="font-serif font-black text-xl m-0 border-b-2 border-ink pb-2">게임 규칙</h2>
          <div className="flex flex-col gap-5 pt-4">
            {RULES.map((r, i) => (
              <article
                key={r.title}
                className={`flex flex-col gap-2 ${i < RULES.length - 1 ? 'pb-5 border-b border-rule' : ''}`}
              >
                <h3 className="font-serif font-black text-xl leading-snug whitespace-nowrap m-0">{r.title}</h3>
                <p className="text-[15px] leading-[1.8] text-ink-soft m-0">{r.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 중앙: 투자자 등록서 (진행 중인 게임이 있으면 안내) */}
        <section className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 lg:px-5 w-full max-w-xl mx-auto lg:max-w-none lg:mx-0 flex flex-col">
          {(inProgress || isFinished) ? (
            <div className="flex-1 bg-paper-card px-6 sm:px-8 py-8 flex flex-col gap-4">
              <span className="font-serif font-black text-[22px] border-b border-ink pb-2.5">
                {isFinished ? '지난 게임이 끝났습니다' : '진행 중인 게임이 있습니다'}
              </span>
              <p className="m-0 text-[15px] leading-[1.8] text-ink-soft">
                {mode === 'contest' && contestInfo
                  ? `대회 ${contestInfo.title || contestInfo.code}에 참가 중입니다.`
                  : `${SIMULATION_QUARTERS}분기 시뮬레이션을 진행 중입니다.`}
                {inLobby ? ' 진행자가 시작하기를 기다리는 중입니다.' : !isFinished && ` 현재 YEAR ${currentYear} Q${currentQuarter}입니다.`}
              </p>
              {inProgress && (
                <button onClick={() => navigate('/')} className="h-[52px] bg-ink hover:bg-ink-soft text-paper text-[17px] font-bold transition-colors">
                  {inLobby ? '대기실로 돌아가기' : '이어서 하기'}
                </button>
              )}
              {isFinished && (
                <>
                  <button onClick={() => navigate('/')} className="h-11 border border-ink text-ink hover:bg-paper-deep text-sm font-medium transition-colors">
                    지난 기록 보기
                  </button>
                  <button onClick={resetAllGameState} className="h-[52px] bg-up hover:brightness-110 text-white text-[17px] font-bold transition">
                    새 게임 시작하기
                  </button>
                </>
              )}
              {inProgress && mode === 'simulation' && (
                <button onClick={startOver} className="text-sm text-mute underline underline-offset-2 self-center">
                  버리고 새로 시작
                </button>
              )}
              {inProgress && mode === 'contest' && (
                <p className="m-0 text-xs text-mute">대회 중에는 새로 시작할 수 없습니다. 끝까지 이어서 진행해주세요.</p>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-paper-card px-6 sm:px-8 pt-6 pb-8 flex flex-col gap-5">
              <div className="flex justify-between items-baseline border-b border-ink pb-2.5">
                <span className="font-serif font-black text-[22px]">투자자 등록서</span>
              </div>

              <Field label="이름" error={errors.userName}>
                <input
                  type="text"
                  value={userName}
                  onChange={e => { setUserName(e.target.value); setErrors(p => ({ ...p, userName: '' })) }}
                  placeholder="홍길동"
                  className={inputCls(!!errors.userName)}
                />
              </Field>

              <Field label="대회 코드 (선택)" error={errors.contestCode}>
                <input
                  type="text"
                  value={contestCode}
                  onChange={e => { setContestCode(e.target.value.toUpperCase()); setErrors(p => ({ ...p, contestCode: '' })) }}
                  placeholder="대회에 참가할 때만 입력"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className={inputCls(!!errors.contestCode)}
                />
                <p className="m-0 text-xs text-mute leading-relaxed">
                  {isContest
                    ? '같은 코드의 참가자들이 같은 기사와 시세로 경쟁합니다. 분기마다 제한시간이 있고, 넘기면 현금과 주식 일부를 잃습니다.'
                    : `비워 두면 ${SIMULATION_QUARTERS}분기 시뮬레이션으로 시작합니다.`}
                </p>
              </Field>

              <Field label="초기 자본" error={errors.capital}>
                <div className={`flex gap-2 ${isContest ? 'opacity-40 pointer-events-none' : ''}`} aria-disabled={isContest}>
                  {CAPITAL_PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setCapitalInput(String(p.value)); setErrors(prev => ({ ...prev, capital: '' })) }}
                      className={`flex-1 h-10 text-sm border border-ink transition-colors ${
                        capital === p.value
                          ? 'bg-ink text-paper font-bold'
                          : 'bg-transparent text-ink hover:bg-paper-deep'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 border-b border-ink ${isContest ? 'opacity-40' : ''}`}>
                  <span className="text-mute">₩</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={isContest}
                    value={capitalInput ? Number(capitalInput).toLocaleString('ko-KR') : ''}
                    onChange={e => handleCapitalInput(e.target.value)}
                    placeholder="10,000,000"
                    className="flex-1 min-w-0 h-11 bg-transparent text-[22px] font-bold text-right focus:outline-none"
                  />
                </div>
                {isContest
                  ? <p className="m-0 text-xs text-mute">대회에서는 초기 자본이 대회 설정으로 정해집니다.</p>
                  : capital >= 1_000_000 && <p className="text-mute text-xs m-0">{formatCapital(capital)}으로 시작</p>}
              </Field>

              {errors.general && (
                <p className="flex items-start gap-1.5 text-up text-xs m-0 leading-relaxed" role="alert">
                  <CircleAlert size={12} className="mt-0.5 shrink-0" />
                  {errors.general}
                </p>
              )}

              <button
                onClick={handleStart}
                disabled={starting}
                className="h-[52px] bg-up hover:brightness-110 disabled:bg-rule disabled:text-mute text-white text-[17px] font-bold transition"
              >
                {starting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {isContest ? '대회에 참가하는 중...' : '첫 분기 뉴스를 준비하는 중...'}
                  </span>
                ) : (
                  isContest ? '대회 참가하기' : '주식 거래 시작하기'
                )}
              </button>
            </div>
          )}

        </section>

        {/* 우: 오늘의 주가 (가격과 등락이 몇 초마다 바뀐다) */}
        <div className="order-3 lg:order-none lg:col-start-3 lg:row-start-1 pt-8 lg:pt-0 lg:pl-7 lg:border-l border-ink">
          <LivePriceBoard />
        </div>

        {/* 아래 왼쪽: 오늘의 기사 (장식용 기사 3개가 돌아간다) */}
        <div className="order-4 lg:order-none lg:col-start-1 lg:col-span-2 lg:row-start-2 mt-8 pt-6 border-t border-ink lg:pr-9">
          <NewsRotator />
        </div>

        {/* 아래 오른쪽: 오늘의 차트 (주가표에서 음영 표시된 종목) */}
        <div className="order-5 lg:order-none lg:col-start-3 lg:row-start-2 mt-8 pt-6 border-t border-ink lg:pl-7 lg:border-l">
          <LiveChart />
        </div>
      </div>

      <footer className="pt-3 mt-6 border-t border-ink text-center text-xs text-mute">
        © 2026 aishift. All rights reserved.
      </footer>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-[15px] font-medium">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-up text-xs m-0">
          <CircleAlert size={12} />
          {error}
        </p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full h-11 bg-transparent border-0 border-b px-1 text-[17px] text-ink placeholder:text-mute/60 focus:outline-none transition-colors ${
    hasError ? 'border-up' : 'border-ink'
  }`
}
