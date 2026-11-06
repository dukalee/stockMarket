import { useEffect, type ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useGameStore } from './stores/gameStore'
import { useMarketStore } from './stores/marketStore'
import { useContestRoundStore } from './stores/contestRoundStore'
import { useContestSync } from './hooks/useContestSync'
import { usePendingForfeitSync } from './hooks/usePendingForfeit'
import { generateQuarterNews } from './engines/staticNewsEngine'
import SetupPage from './pages/SetupPage'
import LobbyPage from './pages/LobbyPage'
import LeaderboardPage from './pages/LeaderboardPage'
import HomePage from './pages/HomePage'
import TradePage from './pages/TradePage'
import NewsPage from './pages/NewsPage'
import NewsArticlePage from './pages/NewsArticlePage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminContestsPage from './pages/AdminContestsPage'

/**
 * 새로고침 직후 상태를 바로잡는다.
 * 분기를 넘기는 도중에 새로고침하면 새 분기의 뉴스가 비어 있을 수 있어서 같은 조건으로 다시 채운다.
 * (제한시간의 시작 시각은 시뮬레이션만 여기서 채운다. 대회는 서버가 알려 준 라운드 시작 시각을 쓴다.)
 */
function useRestoreGame() {
  useEffect(() => {
    const g = useGameStore.getState()
    if (g.phase !== 'playing') return

    if (g.mode === 'simulation' && g.quarterStartedAt === null) g.startRoundTimer()

    const market = useMarketStore.getState()
    if (market.currentNews.length === 0 && !market.newsLoading) {
      const seed = g.mode === 'contest' ? g.contest?.seed : undefined
      generateQuarterNews(g.currentYear, g.currentQuarter, market.stocks, undefined, seed)
        .then(news => useMarketStore.getState().setNews(news))
        .catch(() => { /* 뉴스 페이지의 안내 문구가 대신 보인다 */ })
    }
  }, [])
}

/** 대회 모드: 서버가 라운드 시작 시각을 알려 주면 제한시간을 맞춘다 (새로고침 직후 등) */
function useRoundTimerSync() {
  const phase     = useGameStore(s => s.phase)
  const mode      = useGameStore(s => s.mode)
  const startedAt = useGameStore(s => s.quarterStartedAt)
  const rs        = useContestRoundStore(s => s.state)

  useEffect(() => {
    if (mode === 'contest' && phase === 'playing' && startedAt === null && rs?.roundStartedAt) {
      useGameStore.getState().startRoundTimer(rs.roundStartedAt)
    }
  }, [mode, phase, startedAt, rs])
}

function AppRoutes() {
  const isReady    = useGameStore(s => s.isReady())
  const adminAuth  = useGameStore(s => s.adminAuth)
  const mode       = useGameStore(s => s.mode)
  const phase      = useGameStore(s => s.phase)

  useRestoreGame()
  useContestSync()
  usePendingForfeitSync()   // 연결이 안 돼서 보내지 못한 대회 포기를 연결되면 자동으로 보낸다
  useRoundTimerSync()

  const inLobby = phase === 'lobby'
  // 대회 중에는 관리자 화면을 막는다 — 다음 분기 영향 수치가 그대로 보이기 때문
  const contestLive = mode === 'contest' && (inLobby || phase === 'playing' || phase === 'advancing')

  // 게임 화면: 대기실에 있으면 대기실로, 게임이 없으면 시작 화면으로
  const gate = (el: ReactElement) =>
    inLobby ? <Navigate to="/lobby" replace /> : isReady ? el : <Navigate to="/setup" replace />

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/lobby" element={inLobby ? <LobbyPage /> : <Navigate to={isReady ? '/' : '/setup'} replace />} />
      {/* 순위표는 관리자만 본다. 일반 참가자는 분기가 넘어갈 때 뜨는 순위 팝업으로만 확인한다 */}
      <Route path="/leaderboard" element={contestLive ? <Navigate to="/" replace /> : adminAuth ? <LeaderboardPage /> : <Navigate to="/admin" replace />} />
      <Route path="/"      element={gate(<HomePage />)} />
      <Route path="/trade" element={gate(<TradePage />)} />
      <Route path="/news"  element={gate(<NewsPage />)} />
      <Route path="/news/:id" element={gate(<NewsArticlePage />)} />
      <Route path="/admin" element={contestLive ? <Navigate to="/" replace /> : <AdminLoginPage />} />
      <Route path="/admin/contests" element={contestLive ? <Navigate to="/" replace /> : adminAuth ? <AdminContestsPage /> : <Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
