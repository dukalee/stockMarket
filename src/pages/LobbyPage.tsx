import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useGameStore } from '../stores/gameStore'
import { useContestRoundStore } from '../stores/contestRoundStore'
import { resetAllGameState } from '../services/gameReset'

/** 대회 대기실 — 진행자가 시작하면 모두 동시에 1분기가 열린다 */
export default function LobbyPage() {
  const navigate = useNavigate()
  const phase    = useGameStore(s => s.phase)
  const contest  = useGameStore(s => s.contest)
  const userName = useGameStore(s => s.userName)
  const advanceError = useGameStore(s => s.advanceError)
  const state    = useContestRoundStore(s => s.state)
  const netError = useContestRoundStore(s => s.error)

  // 게임이 시작되면 홈으로
  useEffect(() => {
    if (phase === 'playing' || phase === 'advancing') navigate('/', { replace: true })
  }, [phase, navigate])

  if (!contest) return null

  const starting = state !== null && state.status !== 'lobby'
  // 서버 응답이 오기 전에도 내 이름은 바로 보인다
  const players = state && state.players.length > 0 ? state.players : [userName]

  const leave = () => {
    if (window.confirm('대기실에서 나갈까요? 같은 기기에서 같은 이름으로 다시 들어올 수 있습니다.')) {
      resetAllGameState()
      useContestRoundStore.getState().clear()
      navigate('/setup')
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col px-5 sm:px-10 pt-7 pb-5">
      <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col">
        <div className="flex justify-between items-center text-[13px] pb-2.5 border-b border-ink">
          <span>대회 {contest.title || contest.code}</span>
          <span>shiftStocks</span>
        </div>

        <div className="text-center pt-6 pb-5 border-b-4 border-double border-ink">
          <h1 className="font-serif font-black text-[clamp(36px,7vw,64px)] leading-none tracking-tight m-0">대기실</h1>
          <p className="m-0 mt-3 text-ink-soft text-sm">{userName}님, 참가가 완료됐습니다.</p>
        </div>

        <div className="py-6 flex flex-col items-center gap-1 text-center border-b border-rule" aria-live="polite">
          <span className="text-mute text-xs font-bold tracking-wide">지금 대기 중인 참가자</span>
          <p className="m-0 font-serif font-black leading-none text-[clamp(44px,9vw,72px)] tabular-nums">
            {players.length}<span className="text-2xl ml-1 font-bold">명</span>
          </p>
        </div>

        <div className="py-8 flex flex-col items-center gap-3 text-center border-b border-rule">
          <Loader2 size={28} className="animate-spin text-ink" />
          <p className="font-serif font-black text-xl m-0">
            {starting ? '대회를 시작하는 중입니다' : '진행자가 시작하기를 기다리는 중입니다'}
          </p>
          <p className="m-0 text-sm text-ink-soft leading-relaxed">
            대회가 시작되면 이 화면에서 자동으로 1분기가 열립니다.<br />
            화면을 닫지 말고 그대로 기다려 주세요.
          </p>
        </div>

        <section className="pt-5 flex flex-col gap-3">
          <h2 className="font-serif font-black text-lg m-0 border-b-2 border-ink pb-2">
            참가자 {players.length}명
          </h2>
          <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 gap-x-4">
            {players.map(p => (
              <li key={p} className={`py-2 border-b border-rule text-sm ${p === userName ? 'font-bold' : ''}`}>
                {p}{p === userName && <span className="ml-1.5 text-[11px] text-mute font-normal">나</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-6 text-sm text-ink-soft leading-[1.9]">
          <h2 className="font-serif font-black text-lg m-0 border-b-2 border-ink pb-2 mb-3">대회 규칙</h2>
          <ul className="m-0 pl-5">
            <li>총 {contest.quarters}분기를 진행합니다. 모든 참가자가 같은 기사와 시세로 경쟁합니다.</li>
            <li>분기마다 제한시간은 {Math.round((contest.roundSeconds / 60) * 10) / 10}분입니다.</li>
            <li>마감하지 못하면 보유 현금과 주식의 {Math.round(contest.penaltyRate * 100)}%를 잃고 다음 분기로 넘어갑니다.</li>
            <li>모든 참가자가 마감하면 제한시간 전에도 함께 다음 분기로 넘어갑니다.</li>
          </ul>
        </section>

        {(netError || advanceError) && (
          <p className="text-up text-sm pt-5 m-0" role="alert">{advanceError ?? netError}</p>
        )}

        <div className="pt-8 text-center">
          <button onClick={leave} className="text-sm text-mute underline underline-offset-2 hover:text-ink">대기실에서 나가기</button>
        </div>
      </div>

      <footer className="pt-3 mt-6 border-t border-ink text-center text-xs text-mute">
        © 2026 aishift. All rights reserved.
      </footer>
    </div>
  )
}
