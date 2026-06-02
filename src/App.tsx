import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useGameStore } from './stores/gameStore'
import SetupPage from './pages/SetupPage'
import HomePage from './pages/HomePage'
import TradePage from './pages/TradePage'
import NewsPage from './pages/NewsPage'
import NewsArticlePage from './pages/NewsArticlePage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'

function AppRoutes() {
  const isReady    = useGameStore(s => s.isReady())
  const adminAuth  = useGameStore(s => s.adminAuth)

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/"      element={isReady ? <HomePage />  : <Navigate to="/setup" replace />} />
      <Route path="/trade" element={isReady ? <TradePage /> : <Navigate to="/setup" replace />} />
      <Route path="/news"  element={isReady ? <NewsPage />  : <Navigate to="/setup" replace />} />
      <Route path="/news/:id" element={isReady ? <NewsArticlePage /> : <Navigate to="/setup" replace />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={adminAuth ? <AdminDashboardPage /> : <Navigate to="/admin" replace />} />
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
